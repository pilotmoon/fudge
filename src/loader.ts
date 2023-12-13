import { object, array, string, parse, type Output } from "valibot";
import { type Config } from "./config.js";
import {
  parseJsonObject,
  parsePlistObject,
  parseYamlObject,
} from "./parsers.js";
import { loadSnippet } from "./snippet.js";
import { standardizeConfig } from "./std.js";

const VConfigFiles = array(
  object({
    name: string(),
    contents: string(),
  }),
);

const plistConfigFileName = "Config.plist";
const jsonConfigFileName = "Config.json";
const yamlConfigFileName = "Config.yaml";
const configFileNames = [
  plistConfigFileName,
  jsonConfigFileName,
  yamlConfigFileName,
];

export function loadStaticConfig(obj: Output<typeof VConfigFiles>): Config {
  const configFiles = parse(VConfigFiles, obj);
  const result = {};

  // sort the config files in order; first, in the order of configFileNames, then in alphabetical order
  configFiles.sort((a, b) => {
    const aIndex = configFileNames.indexOf(a.name);
    const bIndex = configFileNames.indexOf(b.name);
    if (aIndex < 0 && bIndex < 0) return a.name.localeCompare(b.name, "en");
    if (aIndex < 0) return 1;
    if (bIndex < 0) return -1;
    return aIndex - bIndex;
  });

  // load the configs in order
  for (const cfg of configFiles) {
    let thisConfig;
    if (cfg.name === plistConfigFileName) {
      thisConfig = standardizeConfig(parsePlistObject(cfg.contents));
    } else if (cfg.name === jsonConfigFileName) {
      thisConfig = standardizeConfig(parseJsonObject(cfg.contents));
    } else if (cfg.name === yamlConfigFileName) {
      thisConfig = standardizeConfig(parseYamlObject(cfg.contents));
    } else {
      thisConfig = loadSnippet(cfg.contents, cfg.name);
    }
    if (thisConfig) {
      Object.assign(result, thisConfig);
    } else {
      throw new Error(`Could not load config from ${cfg.name}`);
    }
  }

  return result;
}
