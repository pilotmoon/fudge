import { lowerCase } from "case-anything";
import { Config, transformConfig } from "./config.js";
import { mapping } from "./mapping.json";

export function standardizeKey(key: string) {
  let k = key;
  if (!k.startsWith("_")) {
    k = lowerCase(k, { keepSpecialCharacters: false });
    k = k.replace(/^(extension|option) /, "");
    k = mapping[k as keyof typeof mapping] || k;
  }
  return k;
}

export function standardizeConfig(config: unknown) {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Cannot standardize that");
  }
  return transformConfig(config as Config, standardizeKey) as Config;
}
