"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardizeConfig = exports.standardizeKey = void 0;
const case_anything_1 = require("case-anything");
const config_js_1 = require("./config.js");
const mapping_json_1 = require("./mapping.json");
function standardizeKey(str) {
    let result = str;
    if (!result.startsWith("_")) {
        result = (0, case_anything_1.lowerCase)(result, { keepSpecialCharacters: false });
        result = result.replace(/^(extension|option) /, "");
        result = mapping_json_1.mapping[result] || result;
    }
    return result;
}
exports.standardizeKey = standardizeKey;
function standardizeConfig(config) {
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
        throw new Error("Cannot standardize that");
    }
    return (0, config_js_1.transform)(config, standardizeKey);
}
exports.standardizeConfig = standardizeConfig;
