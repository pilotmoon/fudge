import { z } from "zod";
import { Config } from "./config.js";
import { parsePlistObject, parseYamlObject } from "./parsers.js";
import { loadSnippet } from "./snippet.js";
import { standardizeConfig } from "./std.js";

const ZConfigFiles = z.array(
  z.object({
    name: z.string(),
    contents: z.string(),
  }),
);
export type ConfigFiles = z.infer<typeof ZConfigFiles>;

const plistConfigFileName = "Config.plist";
const yamlConfigFileNames = ["Config.json", "Config.yaml"];
const configFileNames = [plistConfigFileName, ...yamlConfigFileNames];

export function loadStaticConfig(obj: ConfigFiles): Config {
  const configFiles = ZConfigFiles.parse(obj);
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
    } else if (yamlConfigFileNames.includes(cfg.name)) {
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
