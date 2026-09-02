// Tests for snippet embed-type classification, in particular the language and
// module inference rules (see PopClip Docs/snippet-language-module-inference-design.md).
// Runs against the built index.js — `npm test` rebuilds first.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configFromText, loadSnippet } from "../index.js";

const SELF_REF_FIELDS = [
  "module",
  "javascript file",
  "shell script file",
  "applescript file",
];

// assert the embed type, and optionally which config key ends up holding the
// snippet's self-reference after loadSnippet ("<none>" for no self-reference);
// externalSuffix simulates text originating from a file with that extension
function check(label, text, expectType, expectSelfRef = undefined, externalSuffix = "") {
  it(label, () => {
    const result = configFromText(text, externalSuffix);
    assert.equal(result === null ? "<null>" : result.embedType, expectType);
    if (expectSelfRef !== undefined) {
      const config = loadSnippet(text, result.fileName);
      const field = SELF_REF_FIELDS.find((f) => config[f] === result.fileName);
      assert.equal(field ?? "<none>", expectSelfRef);
    }
  });
}

function checkThrows(label, text, msgPart) {
  it(label, () => {
    assert.throws(
      () => configFromText(text),
      (e) => e instanceof Error && e.message.includes(msgPart),
    );
  });
}

const H = "// #popclip\n// name: Test\n";

describe("language inference", () => {
  check(
    "bare action body infers simple TS",
    `${H}popclip.pasteText("hi")`,
    "typescript",
    "javascript file",
  );
  check(
    "yaml-only snippet untouched",
    "# #popclip\n# name: Test\n# actions: []",
    "yaml",
    "<none>",
  );
  check(
    "explicit language js honored",
    `${H}// language: javascript\nx()`,
    "javascript",
    "javascript file",
  );
  check(
    "interpreter beats inference",
    "# #popclip\n# name: Test\n# interpreter: zsh\necho hi",
    "shell script",
    "shell script file",
  );
  check(
    "shebang beats inference",
    "#!/bin/zsh\n# #popclip\n# name: Test\necho hi",
    "executable shell script",
    "shell script file",
  );
  check("hash prefix does not infer", "# #popclip\n# name: Test\necho hi", "unknown");
  check(
    "applescript prefix infers applescript",
    '-- #popclip\n-- name: Test\nsay "hi"',
    "applescript",
    "applescript file",
  );
  check(
    "explicit applescript still works",
    "-- #popclip\n-- name: Test\n-- language: applescript\nsay hi",
    "applescript",
    "applescript file",
  );
  check(
    "interpreter beats applescript prefix",
    "-- #popclip\n-- name: Test\n-- interpreter: lua\nprint('hi')",
    "shell script",
    "shell script file",
  );
  check(
    "shebang beats applescript prefix",
    "#!/usr/bin/env lua\n-- #popclip\n-- name: Test\nprint('hi')",
    "executable shell script",
    "shell script file",
  );
  check("indented // prefix infers", "  // #popclip\n  // name: Test\nx()", "typescript");
});

describe("module inference triggers", () => {
  check(
    "defineExtension infers module",
    `${H}defineExtension({ actions: [] })`,
    "typescript module",
    "module",
  );
  check("define infers module", `${H}define({ actions: [] })`, "typescript module", "module");
  check(
    "export default infers module",
    `${H}export default { actions: [] }`,
    "typescript module",
    "module",
  );
  check(
    "export const infers module",
    `${H}export const actions = []`,
    "typescript module",
    "module",
  );
  check(
    "export function infers module",
    `${H}export function onClick() {}`,
    "typescript module",
    "module",
  );
  check("export star infers module", `${H}export * from "./x"`, "typescript module");
  check("export brace infers module", `${H}const a = 1\nexport { a }`, "typescript module");
  check(
    "export type infers module (TS)",
    `${H}export type A = string\npopclip.pasteText('x')`,
    "typescript module",
  );
  check(
    "import alone stays simple",
    `${H}import x from "./lib"\npopclip.pasteText(x)`,
    "typescript",
    "javascript file",
  );
  check(
    "import + export is module",
    `${H}import x from "./lib"\nexport default { x }`,
    "typescript module",
    "module",
  );
  check(
    "inference with explicit language js",
    `${H}// language: javascript\ndefineExtension({})`,
    "javascript module",
    "module",
  );
  check(
    "inference with explicit language ts",
    `${H}// language: typescript\nexport default {}`,
    "typescript module",
    "module",
  );
});

describe("bare CJS (official corpus ships keyless bare-CJS packages)", () => {
  check(
    "bare module.exports infers module",
    `${H}module.exports = { actions: [] }`,
    "typescript module",
    "module",
  );
  check(
    "bare exports.foo infers module",
    `${H}exports.actions = []`,
    "typescript module",
    "module",
  );
  check("exports in string stays simple", `${H}popclip.pasteText('module.exports')`, "typescript");
  check(
    "property key module stays simple",
    `${H}popclip.pasteText(JSON.stringify({ module: 1 }))`,
    "typescript",
  );
  check(
    "member access exports stays simple",
    `${H}popclip.pasteText(String(obj.exports))`,
    "typescript",
  );
});

describe("non-code text never triggers", () => {
  check(
    "export in line comment",
    `${H}popclip.pasteText('x')\n// export stuff here`,
    "typescript",
  );
  check(
    "export in block comment",
    `${H}/* export default */ popclip.pasteText('x')`,
    "typescript",
  );
  check("export in string", `${H}popclip.pasteText("export default {}")`, "typescript");
  check("define in string", `${H}popclip.pasteText('defineExtension')`, "typescript");
  check("define in regex", `${H}popclip.pasteText(x.replace(/define/g, ''))`, "typescript");
  check(
    "export in template text",
    `${H}popclip.pasteText(\`export default \${x}\`)`,
    "typescript",
  );
  check(
    "define in template expr triggers",
    `${H}popclip.pasteText(\`\${define()}\`)`,
    "typescript module",
  );
  check(
    "nested template braces",
    `${H}popclip.pasteText(\`\${ {a:\`\${b}\`} }\`)\nexport default {}`,
    "typescript module",
  );
  check(
    "regex after division stays simple",
    `${H}const x = a / b / c\npopclip.pasteText(String(x))`,
    "typescript",
  );
  check("export after regex line", `${H}const r = /abc/g\nexport default {}`, "typescript module");
});

describe("property-position words don't trigger", () => {
  check(
    "property key export",
    `${H}popclip.pasteText(JSON.stringify({ export: 1 }))`,
    "typescript",
  );
  check("member access export", `${H}popclip.pasteText(obj.export)`, "typescript");
  check(
    "property key define",
    `${H}popclip.pasteText(JSON.stringify({ define: 1 }))`,
    "typescript",
  );
  check("member access define", `${H}popclip.pasteText(popclip.define)`, "typescript");
  check(
    "dynamic import stays simple",
    `${H}const m = await import("x")\npopclip.pasteText(m.y)`,
    "typescript",
  );
  check("import.meta stays simple", `${H}popclip.pasteText(import.meta.url)`, "typescript");
  check(
    "shorthand define triggers",
    `${H}const x = { define }\npopclip.pasteText('y')`,
    "typescript module",
  );
});

describe("explicit module key", () => {
  check(
    "module true + language honored",
    `${H}// language: javascript\n// module: true\nmodule.exports = {}`,
    "javascript module",
    "module",
  );
  check(
    "module true without language infers TS",
    `${H}// module: true\nmodule.exports = {}`,
    "typescript module",
    "module",
  );
  check(
    "module false opt-out",
    `${H}// module: false\nexport default {}`,
    "typescript",
    "javascript file",
  );
  checkThrows(
    "module true + hash prefix errors",
    "# #popclip\n# name: Test\n# module: true\necho hi",
    "A 'language' is needed with 'module'",
  );
  checkThrows(
    "string module errors",
    `${H}// module: Config.js\nx()`,
    "'module' must be a boolean",
  );
});

describe("file suffix determines language", () => {
  it("Config.js with bare CJS is a javascript module", () => {
    const text = `${H}exports.action = () => {}`;
    const config = loadSnippet(text, "Config.js");
    assert.equal(config.module, "Config.js");
  });
  check(
    "js suffix + bare body is simple javascript",
    `${H}popclip.pasteText("hi")`,
    "javascript",
    undefined,
    "js",
  );
  check(
    "js suffix + export is a javascript module",
    `${H}export default { actions: [] }`,
    "javascript module",
    undefined,
    "js",
  );
  check(
    "ts suffix + export is a typescript module",
    `${H}export default { actions: [] }`,
    "typescript module",
    undefined,
    "ts",
  );
  check(
    "suffix beats the language key",
    `${H}// language: typescript\nexport default {}`,
    "javascript module",
    undefined,
    "js",
  );
  check(
    "container suffix falls back to inference",
    `${H}popclip.pasteText("hi")`,
    "typescript",
    undefined,
    "popcliptxt",
  );
  check(
    "applescript suffix selects applescript",
    "-- #popclip\n-- name: Test\nsay hi",
    "applescript",
    undefined,
    "applescript",
  );
});

describe("block-comment headers (unsupported for inference, must stay harmless)", () => {
  check(
    "/* on marker line is not a snippet",
    '/* #popclip\nname: Foo\n*/\npopclip.pasteText("x")',
    "<null>",
  );
  check(
    "/* marker with * lines is not a snippet",
    '/* #popclip\n * name: Foo\n */\npopclip.pasteText("x")',
    "<null>",
  );
  check(
    "keyless * header stays unknown",
    '/*\n * #popclip\n * name: Foo\n */\npopclip.pasteText("x")',
    "unknown",
  );
  check(
    "* header + explicit language works",
    '/*\n * #popclip\n * name: Foo\n * language: javascript\n */\npopclip.pasteText("x")',
    "javascript",
    "javascript file",
  );
  check(
    "* header + language + export infers module",
    "/*\n * #popclip\n * name: Foo\n * language: javascript\n */\nexport default { actions: [] }",
    "javascript module",
    "module",
  );
  check(
    "/// prefix counts as //",
    '/// #popclip\n/// name: Foo\npopclip.pasteText("x")',
    "typescript",
  );
  check(
    "unterminated /* in body errs simple",
    `${H}popclip.pasteText("x")\n/* export default {}`,
    "typescript",
  );
});

describe("performance", () => {
  it("no pathological scan on large inputs", () => {
    const noMarker = "x".repeat(2_000_000);
    let start = Date.now();
    configFromText(noMarker);
    assert.ok(Date.now() - start < 500, "2MB no-marker file should parse fast");
    const bigCode = H + "const aVar = 1; popclip.pasteText(`${aVar} / 2 / 3`);\n".repeat(20000);
    start = Date.now();
    configFromText(bigCode);
    assert.ok(Date.now() - start < 2000, "1MB code body should sniff fast");
  });
});
