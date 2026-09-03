// Tests for sniffEntitlements — the load-time sniff for API use that needs
// the network or script entitlement. Runs against the built index.js —
// `npm test` rebuilds first. (sniffModule is exercised through the snippet
// classification tests.)
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffEntitlements } from "../index.js";

// assert exactly these hits, as "entitlement:trigger" strings in source order
function check(label, source, expected) {
  it(label, () => {
    const hits = sniffEntitlements(source).map(
      (h) => `${h.entitlement}:${h.trigger}`,
    );
    assert.deepEqual(hits, expected);
  });
}

describe("network triggers", () => {
  check("XMLHttpRequest constructor", `const xhr = new XMLHttpRequest();`, [
    "network:XMLHttpRequest",
  ]);
  check("XMLHttpRequest via globalThis", `globalThis.XMLHttpRequest`, [
    "network:XMLHttpRequest",
  ]);
  check("axios require", `const ax = require("axios");`, ["network:axios"]);
  check("axios require single-quoted", `const ax = require('axios');`, [
    "network:axios",
  ]);
  check("axios ESM default import", `import axios from "axios";`, [
    "network:axios",
  ]);
  check("axios ESM named import", `import { get } from "axios";`, [
    "network:axios",
  ]);
  check("axios side-effect import", `import "axios";`, ["network:axios"]);
  check("axios dynamic import", `const ax = await import("axios");`, [
    "network:axios",
  ]);
  check("require with spaces", `const ax = require ( "axios" );`, [
    "network:axios",
  ]);
});

describe("network non-triggers", () => {
  check("XMLHttpRequest in a comment", `// uses XMLHttpRequest internally`, []);
  check("XMLHttpRequest in a string", `const s = "XMLHttpRequest";`, []);
  check("XMLHttpRequest in a template", "const s = `XMLHttpRequest`;", []);
  check("axios as a data string", `const name = "axios";`, []);
  check("axios as an identifier alone", `const axios = makeClient();`, []);
  check("other module specifier", `import { x } from "emoji-regex";`, []);
  check(
    "axios string in an unrelated call",
    `console.log("axios", "is not imported");`,
    [],
  );
  check("property key XMLHttpRequest", `const o = { XMLHttpRequest: 1 };`, []);
});

describe("script triggers", () => {
  check(
    "popclip.runAppleScript call",
    `await popclip.runAppleScript("beep");`,
    ["script:runAppleScript"],
  );
  check(
    "destructured runShellScript",
    `const { runShellScript } = popclip; await runShellScript("ls");`,
    ["script:runShellScript"],
  );
  check(
    "runShellScriptFile",
    `await popclip.runShellScriptFile("go.sh");`,
    ["script:runShellScriptFile"],
  );
  check(
    "runAppleScriptFile",
    `await popclip.runAppleScriptFile("x.applescript");`,
    ["script:runAppleScriptFile"],
  );
  check("shell tag", "await $`echo hi`;", ["script:$"]);
  check("shell tag with interpolation", "await $`echo ${text}`;", [
    "script:$",
  ]);
  check(
    "configured shell tag",
    'const zsh = $({ interpreter: "/bin/zsh" });',
    ["script:$"],
  );
  check("options call with spaces", "$ ( { env } )`x`;", ["script:$"]);
});

describe("script non-triggers", () => {
  check("runAppleScript in a comment", `// calls runAppleScript eventually`, []);
  check("runAppleScript in a string", `const doc = "use runAppleScript";`, []);
  check("jQuery-style dollar call", `$("selector").hide();`, []);
  check("dollar as property", `foo.$;`, []);
  check("bare dollar identifier", `const cost = $ + 1;`, []);
  check("dollar in a template", "const t = `price: $ {x}`;", []);
  check("property key runShellScript", `const o = { runShellScript: 1 };`, []);
  check(
    "typescript param named after method",
    `function f(runShellScript: string) {}`,
    [],
  );
});

describe("combinations", () => {
  check(
    "both entitlements, source order",
    `const ax = require("axios");\nawait popclip.runShellScript("ls");`,
    ["network:axios", "script:runShellScript"],
  );
  check(
    "first trigger per entitlement wins",
    "await $`ls`;\nawait popclip.runAppleScript('beep');",
    ["script:$"],
  );
  check(
    "regex containing a trigger name is skipped",
    `const re = /XMLHttpRequest/; await popclip.runShellScript("ls");`,
    ["script:runShellScript"],
  );
  check(
    "code inside template interpolation is scanned",
    "const msg = `result: ${popclip.runAppleScript(src)}`;",
    ["script:runAppleScript"],
  );
});

describe("performance", () => {
  it("large body sniffs fast", () => {
    const body = 'const a = "x"; // XMLHttpRequest in comment\n'.repeat(25000);
    const start = Date.now();
    assert.deepEqual(sniffEntitlements(body), []);
    assert.ok(Date.now() - start < 2000, "1MB code body should sniff fast");
  });
});
