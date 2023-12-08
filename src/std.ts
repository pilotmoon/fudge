import { lowerCase } from "case-anything";
import { Config, transform } from "./config.js";
import { mapping } from "./mapping.json";
export function standardizeKey(str: string) {
  let result = str;
  if (!result.startsWith("_")) {
    result = lowerCase(result, { keepSpecialCharacters: false });
    result = result.replace(/^(extension|option) /, "");
    result = mapping[result as keyof typeof mapping] || result;
  }
  return result;
}

export function standardizeConfig(config: unknown) {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Cannot standardize that");
  }
  return transform(config as Config, standardizeKey) as Config;
}
