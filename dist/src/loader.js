"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStaticConfig = void 0;
const zod_1 = require("zod");
const parsers_js_1 = require("./parsers.js");
const snippet_js_1 = require("./snippet.js");
const std_js_1 = require("./std.js");
const ZConfigFiles = zod_1.z.array(zod_1.z.object({
    name: zod_1.z.string(),
    contents: zod_1.z.string(),
}));
const plistConfigFileName = "Config.plist";
const yamlConfigFileNames = ["Config.json", "Config.yaml"];
const configFileNames = [plistConfigFileName, ...yamlConfigFileNames];
function loadStaticConfig(obj) {
    const configFiles = ZConfigFiles.parse(obj);
    const result = {};
    // sort the config files in order; first, in the order of configFileNames, then in alphabetical order
    configFiles.sort((a, b) => {
        const aIndex = configFileNames.indexOf(a.name);
        const bIndex = configFileNames.indexOf(b.name);
        if (aIndex < 0 && bIndex < 0)
            return a.name.localeCompare(b.name, "en");
        if (aIndex < 0)
            return 1;
        if (bIndex < 0)
            return -1;
        return aIndex - bIndex;
    });
    // load the configs in order
    for (const cfg of configFiles) {
        let thisConfig;
        if (cfg.name === plistConfigFileName) {
            thisConfig = (0, std_js_1.standardizeConfig)((0, parsers_js_1.parsePlistObject)(cfg.contents));
        }
        else if (yamlConfigFileNames.includes(cfg.name)) {
            thisConfig = (0, std_js_1.standardizeConfig)((0, parsers_js_1.parseYamlObject)(cfg.contents));
        }
        else {
            thisConfig = (0, snippet_js_1.loadSnippet)(cfg.contents, cfg.name);
        }
        if (thisConfig) {
            Object.assign(result, thisConfig);
        }
        else {
            throw new Error(`Could not load config from ${cfg.name}`);
        }
    }
    return result;
}
exports.loadStaticConfig = loadStaticConfig;
