// Token-scan sniffs over JS/TS source: module-ness (sniffModule) and
// entitlement-requiring API use (sniffEntitlements). One shared scanner walks
// the source comment-, string-, template- and regex-aware, so words inside
// non-code text can never trigger; the sniffs differ only in what they look
// for. Declaration tracking is out of scope (that needs a real parser), so a
// local declared with a trigger name false-positives; each sniff's caller
// owns that trade-off.

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

// next(1) is the first significant character after the current token, next(2)
// the one after that; whitespace-only skipping — a comment in between defeats
// the lookahead, erring toward not matching
type NextFn = (k?: 1 | 2) => string;

type ScanCallbacks = {
  // an identifier/keyword token; return true to stop the scan
  word?: (word: string, prev: string, next: NextFn) => boolean;
  // a single punctuation character or a number token (numbers matter only as
  // "something intervened"; strings and templates are reported/skipped
  // separately and leave prev as ")")
  punct?: (token: string, prev: string) => boolean;
  // a '...'/"..." string literal's raw contents (escapes unprocessed)
  string?: (value: string, prev: string) => boolean;
};

// returns true when a callback stopped the scan
function scanTokens(source: string, callbacks: ScanCallbacks): boolean {
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

  // scan a string literal from i (at the opening quote), returning its raw
  // contents; unterminated strings resync at end of line
  function scanString(quote: string) {
    const start = ++i;
    while (i < n) {
      const c = source[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      i++;
      if (c === quote) {
        return source.slice(start, i - 1);
      }
      if (c === "\n" || c === "\r") {
        return source.slice(start, i - 1);
      }
    }
    return source.slice(start, n);
  }

  // scan a regex literal from i (at the opening slash); a regex cannot span
  // lines, so hitting EOL means it wasn't a regex after all — resync there
  // (over-skipping errs toward not matching, the benign direction)
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

  // kth significant character at or after position j (skips whitespace only)
  function nextFrom(j: number, k: 1 | 2) {
    while (j < n && /\s/.test(source[j])) {
      j++;
    }
    if (k === 2) {
      j++;
      while (j < n && /\s/.test(source[j])) {
        j++;
      }
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
        if (callbacks.punct?.("/", prevToken)) {
          return true;
        }
        prevToken = "/";
      } else {
        scanRegex();
        prevToken = ")"; // a regex ends an expression
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const value = scanString(c);
      if (callbacks.string?.(value, prevToken)) {
        return true;
      }
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
      if (callbacks.punct?.("{", prevToken)) {
        return true;
      }
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
        if (callbacks.punct?.("}", prevToken)) {
          return true;
        }
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
      const next: NextFn = (k = 1) => nextFrom(j, k);
      if (callbacks.word?.(word, prevToken, next)) {
        return true;
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
      const number = source.slice(i, j);
      if (callbacks.punct?.(number, prevToken)) {
        return true;
      }
      prevToken = number;
      i = j;
      continue;
    }
    i++;
    if (callbacks.punct?.(c, prevToken)) {
      return true;
    }
    prevToken = c;
  }
  return false;
}

// Decide whether a JS/TS snippet body is a module. Triggers are top-level ESM
// `export` syntax and references to the module wrapper's own globals
// (`exports`, `module`, `define`, `defineExtension`). Top-level `import` is
// deliberately NOT a trigger: sucrase turns it into `require()` calls that
// work fine in a simple action body, and existing simple snippets import
// libraries without exporting. The CJS globals ARE triggers because the
// official corpus ships keyless bare-CJS package modules (`exports.action =`
// under a #popclip header) that must keep loading as modules. A false
// "module" verdict would execute an action body at config-load time, whereas
// a false "simple" just fails loudly at first click; `module: false` is the
// escape hatch for a declared shadow.

const MODULE_GLOBALS = new Set([
  "exports",
  "module",
  "define",
  "defineExtension",
]);

export function sniffModule(source: string): boolean {
  return scanTokens(source, {
    word(word, prev, next) {
      if (prev === "." || prev === "#") {
        return false;
      }
      if (word === "export") {
        // ESM export is always followed by a declaration keyword,
        // `default`, `{` or `*`; anything else (`:`, `(`, `=`) is a
        // property or field named "export"
        const c = next();
        return c === "{" || c === "*" || isIdStart(c);
      }
      // a free-standing reference; only a property key (`define:`) is
      // excluded — declared shadows are accepted as a known false
      // positive of scanning without declaration tracking
      return MODULE_GLOBALS.has(word) && next() !== ":";
    },
  });
}

// Sniff for API use that needs an entitlement the config may not declare —
// a courtesy diagnostic so a forgotten entitlement surfaces at load rather
// than as a runtime refusal; the runtime gates remain the authority.
//
// network: the `XMLHttpRequest` global (the only native network gate — all
// network access funnels through it), and the bundled `axios` module, which
// is only reachable by naming it as a require/import specifier string.
// script: the four popclip script-running methods by name wherever they
// appear as identifiers (property access included — `popclip.runShellScript`
// and a destructured `runShellScript` both count), and the `$` shell tag in
// its two call shapes: tagging a template, and the options call `$({...})`
// (a bare `$(x)` doesn't count — that's a shadowed jQuery-style helper).

const NETWORK_GLOBALS = new Set(["XMLHttpRequest"]);
const NETWORK_MODULES = new Set(["axios"]);
const SCRIPT_METHODS = new Set([
  "runAppleScript",
  "runAppleScriptFile",
  "runShellScript",
  "runShellScriptFile",
]);

export type SniffedEntitlement = "network" | "script";

export interface EntitlementHit {
  entitlement: SniffedEntitlement;
  // what the sniff matched, for the error message: an identifier name,
  // a module specifier, or "$"
  trigger: string;
}

// first hit per entitlement, in source order
export function sniffEntitlements(source: string): EntitlementHit[] {
  const hits = new Map<SniffedEntitlement, EntitlementHit>();
  function record(entitlement: SniffedEntitlement, trigger: string) {
    if (!hits.has(entitlement)) {
      hits.set(entitlement, { entitlement, trigger });
    }
    return hits.size === 2; // both found — stop the scan
  }
  // whether the next string literal is a require/import specifier: set at the
  // `(` of `require(`/`import(`, cleared by any other token in between
  let expectSpecifier = false;
  scanTokens(source, {
    word(word, prev, next) {
      expectSpecifier = false;
      if (prev === "#") {
        return false; // a private field is a declared shadow
      }
      if (word === "$") {
        if (prev === ".") {
          return false; // a property named $, not the global
        }
        const c = next();
        if (c === "`" || (c === "(" && next(2) === "{")) {
          return record("script", "$");
        }
        return false;
      }
      if (next() === ":") {
        return false; // a property key, not a reference
      }
      if (SCRIPT_METHODS.has(word)) {
        return record("script", word);
      }
      if (NETWORK_GLOBALS.has(word)) {
        return record("network", word);
      }
      return false;
    },
    punct(token, prev) {
      expectSpecifier =
        token === "(" && (prev === "require" || prev === "import");
      return false;
    },
    string(value, prev) {
      const isSpecifier =
        expectSpecifier || prev === "from" || prev === "import";
      expectSpecifier = false;
      if (isSpecifier && NETWORK_MODULES.has(value)) {
        return record("network", value);
      }
      return false;
    },
  });
  return [...hits.values()];
}
