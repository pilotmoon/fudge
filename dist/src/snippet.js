"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSnippet = exports.configFromText = exports.lines = void 0;
const parsers_js_1 = require("./parsers.js");
const std_js_1 = require("./std.js");
function lines(string) {
    return string.split(/\r\n|\n|\r/);
}
exports.lines = lines;
// return all lines with the given prefix, with the prefix removed.
// the output stops at the first empty or unprefixed line.
function extractPrefixedBlock(string, prefix) {
    const result = [];
    for (const line of lines(string)) {
        if (line !== "" && (prefix === "" || line.startsWith(prefix))) {
            result.push(line.replace(prefix, ""));
        }
        else {
            break;
        }
    }
    return result.join("\n");
}
// extract what might possibly be a #popclip YAML header from the given string
function candidateYaml(string) {
    // get the line starting with with #popclip and all subsequent content
    const components = string.match(/([^\n]*)# ?popclip.+$/is);
    if ((components === null || components === void 0 ? void 0 : components.length) !== 2) {
        return null;
    }
    // then extract the candidate lines
    const candidateYaml = extractPrefixedBlock(components[0], components[1]);
    // a snippet always contains something like `name: ` or `name":`
    if (!/name\"\s*:|name: /is.test(candidateYaml)) {
        return null;
    }
    // allow no no nbsp in yaml; parser doesn't like it
    return candidateYaml.replace(/\u00A0/g, " ").trim();
}
var EmbedType;
(function (EmbedType) {
    EmbedType["Unknown"] = "unknown";
    EmbedType["Yaml"] = "yaml";
    EmbedType["ShellScript"] = "shell script";
    EmbedType["Executable"] = "executable shell script";
    EmbedType["AppleScript"] = "applescript";
    EmbedType["JavaScript"] = "javascript";
    EmbedType["TypeScript"] = "typescript";
    EmbedType["JavaScriptModule"] = "javascript module";
    EmbedType["TypeScriptModule"] = "typescript module";
})(EmbedType || (EmbedType = {}));
function embedTypeFromText(text, yaml, config) {
    let result = EmbedType.Unknown;
    let { module, language, interpreter } = config;
    module = typeof module === "boolean" ? config : false;
    language = typeof language === "string" ? (0, std_js_1.standardizeKey)(language) : "";
    interpreter = typeof interpreter === "string" ? (0, std_js_1.standardizeKey)(interpreter) : "";
    const hasAdditionalContent = lines(text.trim()).length > lines(yaml.trim()).length;
    if (hasAdditionalContent) {
        if (language === "javascript") {
            if (module) {
                result = EmbedType.JavaScriptModule;
            }
            else {
                result = EmbedType.JavaScript;
            }
        }
        else if (language === "typescript") {
            if (module) {
                result = EmbedType.TypeScriptModule;
            }
            else {
                result = EmbedType.TypeScript;
            }
        }
        else if (language === "applescript") {
            result = EmbedType.AppleScript;
        }
        else if (interpreter.length > 0) {
            result = EmbedType.ShellScript;
        }
        else if (text.startsWith("#!")) {
            result = EmbedType.Executable;
        }
    }
    else {
        result = EmbedType.Yaml;
    }
    return result;
}
// look for tabs that seem to be outside braces;
// this is just for a helpful message, false negatives acceptable.
function hasTabsInBlock(yamlSource) {
    for (const line of lines(yamlSource)) {
        const parts = line.split("{");
        if (parts[0].includes("\t"))
            return true;
        if (parts.length > 1)
            break;
    }
    return false;
}
function configFromText(text) {
    const yaml = candidateYaml(text);
    if (yaml === null) {
        return null;
    }
    if (hasTabsInBlock(yaml)) {
        throw new Error("Don't use tabs in YAML");
    }
    const config = (0, std_js_1.standardizeConfig)((0, parsers_js_1.parseYamlObject)(yaml));
    const embedType = embedTypeFromText(text, yaml, config);
    return { config, embedType };
}
exports.configFromText = configFromText;
function loadSnippet(text, fileName) {
    var _a;
    try {
        const { config, embedType } = (_a = configFromText(text)) !== null && _a !== void 0 ? _a : {
            config: {},
            embedType: EmbedType.Unknown,
        };
        const fieldName = {
            [EmbedType.ShellScript]: "shell script file",
            [EmbedType.Executable]: "shell script file",
            [EmbedType.JavaScript]: "javascript file",
            [EmbedType.TypeScript]: "javascript file",
            [EmbedType.AppleScript]: "applescript file",
            [EmbedType.JavaScriptModule]: "module",
            [EmbedType.TypeScriptModule]: "module",
            [EmbedType.Yaml]: null,
            [EmbedType.Unknown]: null,
        }[embedType];
        if (fieldName) {
            config[fieldName] = fileName;
        }
        return config;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "unknown error";
        throw new Error(`Could not understand ${fileName}. (${msg})`);
    }
}
exports.loadSnippet = loadSnippet;
