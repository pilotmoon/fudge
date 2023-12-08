import { lowerCase } from "case-anything";
import { transform } from "./config.js";
import { mapping } from "./mapping.json";
export function standardizeKey(str) {
    let result = str;
    if (!result.startsWith("_")) {
        result = lowerCase(result, { keepSpecialCharacters: false });
        result = result.replace(/^(extension|option) /, "");
        result = mapping[result] || result;
    }
    return result;
}
export function standardizeConfig(config) {
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
        throw new Error("Cannot standardize that");
    }
    return transform(config, standardizeKey);
}
