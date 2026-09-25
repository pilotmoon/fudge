// Tests for sniffOutput — the load-time sniff for popclip.output calls, which
// decides whether PopClip offers the Output selector. Runs against the built
// index.js — `npm test` rebuilds first.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffOutput } from "../index.js";

function check(label, source, expected) {
  it(label, () => {
    assert.equal(sniffOutput(source), expected);
  });
}

describe("output triggers", () => {
  check("plain call", `await popclip.output(text);`, true);
  check("with options", `popclip.output(md, { markdown: true })`, true);
  check("spaced member access", `popclip . output(x)`, true);
  check("via globalThis", `globalThis.popclip.output(x)`, true);
  check("optional chaining", `popclip?.output(x)`, true);
  check("TypeScript non-null", `popclip!.output(x)`, true);
  check("inside a module action", `exports.actions = [{ code: async (input) => { await popclip.output(input.text); } }];`, true);
  check("passed as a reference", `const deliver = popclip.output;`, true);
});

describe("output non-triggers", () => {
  check("bare identifier", `const output = run(); log(output);`, false);
  check("other object", `result.output(x)`, false);
  check("destructured (declaration covers it)", `const { output } = popclip; output(x);`, false);
  check("computed property", `popclip["output"](x)`, false);
  check("longer name", `popclip.outputs`, false);
  check("in a comment", `// popclip.output(x)\n/* popclip.output(y) */`, false);
  check("in a string", `const s = "popclip.output(x)";`, false);
  check("in a template", "const s = `popclip.output(${x})`;", false);
  check("other popclip method", `popclip.pasteText(x)`, false);
  check("dot resets", `popclip.pasteText(a.output)`, false);
});
