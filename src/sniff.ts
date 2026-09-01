// Decide whether a JS/TS snippet body is a module by token scan. Triggers are
// top-level ESM `export` syntax and references to the module wrapper's own
// globals (`exports`, `module`, `define`, `defineExtension`). Top-level
// `import` is deliberately NOT a trigger: sucrase turns it into `require()`
// calls that work fine in a simple action body, and existing simple snippets
// import libraries without exporting. The CJS globals ARE triggers because the
// official corpus ships keyless bare-CJS package modules (`exports.action =`
// under a #popclip header) that must keep loading as modules.
//
// The scan is comment-, string-, template- and regex-aware so that words inside
// non-code text can never imply module-ness — a false "module" verdict would
// execute an action body at config-load time, whereas a false "simple" just
// fails loudly at first click. Declaration tracking is out of scope (that needs
// a real parser), so a simple body that declares a local named after a wrapper
// global false-positives; `module: false` is the escape hatch.

const MODULE_GLOBALS = new Set(["exports", "module", "define", "defineExtension"]);

// words after which a `/` begins a regex literal rather than division
const NON_EXPRESSION_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "do",
  "else",
  "case",
  "yield",
  "await",
]);

function isIdStart(c: string) {
  return /[A-Za-z_$]/.test(c);
}

function isIdChar(c: string) {
  return /[A-Za-z0-9_$]/.test(c);
}

// whether a `/` after this token is division (token ends an expression);
// otherwise it starts a regex literal
function endsExpression(token: string) {
  if (token === ")" || token === "]") {
    return true;
  }
  if (isIdStart(token[0] ?? "") || /[0-9]/.test(token[0] ?? "")) {
    return !NON_EXPRESSION_KEYWORDS.has(token);
  }
  return false;
}

export function sniffModule(source: string): boolean {
  const n = source.length;
  let i = 0;
  let prevToken = "";
  let braceDepth = 0;
  // brace depth at each unclosed `${` — non-empty means a `}` at the recorded
  // depth resumes template text rather than closing a block
  const templateStack: number[] = [];

  // scan template text from i (at the opening ` or the resuming `}`);
  // returns true when stopping at `${` (back to code), false at the closing `
  function scanTemplate() {
    i++;
    while (i < n) {
      const c = source[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        i++;
        return false;
      }
      if (c === "$" && source[i + 1] === "{") {
        i += 2;
        return true;
      }
      i++;
    }
    return false;
  }

  // scan a string literal from i (at the opening quote); unterminated
  // strings resync at end of line
  function scanString(quote: string) {
    i++;
    while (i < n) {
      const c = source[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      i++;
      if (c === quote || c === "\n" || c === "\r") {
        return;
      }
    }
  }

  // scan a regex literal from i (at the opening slash); a regex cannot span
  // lines, so hitting EOL means it wasn't a regex after all — resync there
  // (over-skipping errs toward "simple", the benign direction)
  function scanRegex() {
    i++;
    let inClass = false;
    while (i < n) {
      const c = source[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "\n" || c === "\r") {
        return;
      }
      i++;
      if (c === "[") {
        inClass = true;
      } else if (c === "]") {
        inClass = false;
      } else if (c === "/" && !inClass) {
        while (i < n && isIdChar(source[i])) {
          i++; // flags
        }
        return;
      }
    }
  }

  // first significant character at or after position j (skips whitespace only)
  function nextChar(j: number) {
    while (j < n && /\s/.test(source[j])) {
      j++;
    }
    return source[j] ?? "";
  }

  while (i < n) {
    const c = source[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "/") {
      const d = source[i + 1];
      if (d === "/") {
        while (i < n && source[i] !== "\n" && source[i] !== "\r") {
          i++;
        }
      } else if (d === "*") {
        const close = source.indexOf("*/", i + 2);
        i = close === -1 ? n : close + 2;
      } else if (endsExpression(prevToken)) {
        i++;
        prevToken = "/";
      } else {
        scanRegex();
        prevToken = ")"; // a regex ends an expression
      }
      continue;
    }
    if (c === "'" || c === '"') {
      scanString(c);
      prevToken = ")"; // a string ends an expression
      continue;
    }
    if (c === "`") {
      if (scanTemplate()) {
        templateStack.push(braceDepth);
      } else {
        prevToken = ")";
      }
      continue;
    }
    if (c === "{") {
      braceDepth++;
      i++;
      prevToken = "{";
      continue;
    }
    if (c === "}") {
      if (
        templateStack.length > 0 &&
        templateStack[templateStack.length - 1] === braceDepth
      ) {
        templateStack.pop();
        if (scanTemplate()) {
          templateStack.push(braceDepth);
        } else {
          prevToken = ")";
        }
      } else {
        braceDepth = Math.max(0, braceDepth - 1);
        i++;
        prevToken = "}";
      }
      continue;
    }
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdChar(source[j])) {
        j++;
      }
      const word = source.slice(i, j);
      if (prevToken !== "." && prevToken !== "#") {
        if (word === "export") {
          // ESM export is always followed by a declaration keyword,
          // `default`, `{` or `*`; anything else (`:`, `(`, `=`) is a
          // property or field named "export"
          const next = nextChar(j);
          if (next === "{" || next === "*" || isIdStart(next)) {
            return true;
          }
        } else if (MODULE_GLOBALS.has(word)) {
          // a free-standing reference; only a property key (`define:`) is
          // excluded — declared shadows are accepted as a known false
          // positive of scanning without declaration tracking
          if (nextChar(j) !== ":") {
            return true;
          }
        }
      }
      prevToken = word;
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_$.]/.test(source[j])) {
        j++;
      }
      prevToken = source.slice(i, j);
      i = j;
      continue;
    }
    i++;
    prevToken = c;
  }
  return false;
}
