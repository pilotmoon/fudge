// src/loader.ts
import {z as z2} from "zod";

// src/parsers.ts
import {parse as parsePlist} from "fast-plist";
import {JSON_SCHEMA, load as parseYaml} from "js-yaml";
import {z} from "zod";
function parsePlistObject(plist) {
  try {
    return ZConfigObject.parse(parsePlist(plist.replace(/<key>Credits<\/key>\s*<array>[\s\S]*?<\/array>/, "")));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error("Invalid config");
    }
    if (e instanceof Error) {
      throw new Error(`Invalid plist: ${e.message}`);
    }
    throw new Error("Invalid plist");
  }
}
function parseJsonObject(jsonSource) {
  try {
    return ZConfigObject.parse(JSON.parse(jsonSource));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error("Invalid config");
    }
    if (e instanceof Error) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    throw new Error("Invalid JSON");
  }
}
function parseYamlObject(yamlSource) {
  try {
    return ZConfigObject.parse(parseYaml(yamlSource, {
      schema: JSON_SCHEMA
    }));
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error("Invalid config");
    }
    if (e instanceof Error) {
      throw new Error(`Invalid YAML: ${e.message}`);
    }
    throw new Error("Invalid YAML");
  }
}
var ZConfigObject = z.record(z.unknown());

// src/std.ts
import {lowerCase} from "case-anything";

// src/config.ts
function transform(val, fn) {
  if (typeof val !== "object" || val === null)
    return val;
  const result = {};
  for (const [key, obj] of Object.entries(val)) {
    if (Array.isArray(obj)) {
      result[fn(key)] = obj.map((item) => transform(item, fn));
    } else {
      result[fn(key)] = transform(obj, fn);
    }
  }
  return result;
}

// src/mapping.json
var mapping = {
  "image file": "icon",
  "required software version": "popclip version",
  "pop clip version": "popclip version",
  "required os version": "macos version",
  "mac os version": "macos version",
  "pass html": "capture html",
  "blocked apps": "excluded apps",
  "regular expression": "regex",
  "apple script file": "applescript file",
  "apple script call": "applescript call",
  "apple script": "applescript",
  "java script file": "javascript file",
  "java script": "javascript",
  "type script": "typescript",
  "script interpreter": "interpreter",
  "preserve image color": "preserve color",
  "flip horizontal": "flip x",
  "flip vertical": "flip y",
  lang: "language",
  js: "javascript",
  ts: "typescript",
  params: "parameters"
};

// src/std.ts
function standardizeKey(key) {
  let k = key;
  if (!k.startsWith("_")) {
    k = lowerCase(k, { keepSpecialCharacters: false });
    k = k.replace(/^(extension|option) /, "");
    k = mapping[k] || k;
  }
  return k;
}
function standardizeConfig(config2) {
  if (typeof config2 !== "object" || config2 === null || Array.isArray(config2)) {
    throw new Error("Cannot standardize that");
  }
  return transform(config2, standardizeKey);
}

// src/snippet.ts
function lines(string) {
  return string.split(/\r\n|\n|\r/);
}
var extractPrefixedBlock = function(string, prefix) {
  const result = [];
  for (const line of lines(string)) {
    if (line !== "" && (prefix === "" || line.startsWith(prefix))) {
      result.push(line.replace(prefix, ""));
    } else {
      break;
    }
  }
  return result.join("\n");
};
var candidateYaml = function(string) {
  const components = string.match(/([^\n]*)# ?popclip.+$/is);
  if (components?.length !== 2) {
    return null;
  }
  const candidateYaml2 = extractPrefixedBlock(components[0], components[1]);
  if (!/name\"\s*:|name: /is.test(candidateYaml2)) {
    return null;
  }
  return candidateYaml2.replace(/\u00A0/g, " ").trim();
};
var embedTypeFromText = function(text, yaml, config2) {
  let result = EmbedType.Unknown;
  let { module, language, interpreter } = config2;
  module = typeof module === "boolean" ? config2 : false;
  language = typeof language === "string" ? standardizeKey(language) : "";
  interpreter = typeof interpreter === "string" ? standardizeKey(interpreter) : "";
  const hasAdditionalContent = lines(text.trim()).length > lines(yaml.trim()).length;
  if (hasAdditionalContent) {
    if (language === "javascript") {
      if (module) {
        result = EmbedType.JavaScriptModule;
      } else {
        result = EmbedType.JavaScript;
      }
    } else if (language === "typescript") {
      if (module) {
        result = EmbedType.TypeScriptModule;
      } else {
        result = EmbedType.TypeScript;
      }
    } else if (language === "applescript") {
      result = EmbedType.AppleScript;
    } else if (interpreter.length > 0) {
      result = EmbedType.ShellScript;
    } else if (text.startsWith("#!")) {
      result = EmbedType.Executable;
    }
  } else {
    result = EmbedType.Yaml;
  }
  return result;
};
var hasTabsInBlock = function(yamlSource) {
  for (const line of lines(yamlSource)) {
    const parts = line.split("{");
    if (parts[0].includes("\t"))
      return true;
    if (parts.length > 1)
      break;
  }
  return false;
};
function configFromText(text) {
  const yaml = candidateYaml(text);
  if (yaml === null) {
    return null;
  }
  if (hasTabsInBlock(yaml)) {
    throw new Error("Don't use tabs in YAML");
  }
  const config2 = standardizeConfig(parseYamlObject(yaml));
  const embedType = embedTypeFromText(text, yaml, config2);
  return { config: config2, embedType };
}
function loadSnippet(text, fileName) {
  try {
    const { config: config2, embedType } = configFromText(text) ?? {
      config: {},
      embedType: EmbedType.Unknown
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
      [EmbedType.Unknown]: null
    }[embedType];
    if (fieldName) {
      config2[fieldName] = fileName;
    }
    return config2;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Could not understand ${fileName}. (${msg})`);
  }
}
var EmbedType;
(function(EmbedType2) {
  EmbedType2["Unknown"] = "unknown";
  EmbedType2["Yaml"] = "yaml";
  EmbedType2["ShellScript"] = "shell script";
  EmbedType2["Executable"] = "executable shell script";
  EmbedType2["AppleScript"] = "applescript";
  EmbedType2["JavaScript"] = "javascript";
  EmbedType2["TypeScript"] = "typescript";
  EmbedType2["JavaScriptModule"] = "javascript module";
  EmbedType2["TypeScriptModule"] = "typescript module";
})(EmbedType || (EmbedType = {}));

// src/loader.ts
function loadStaticConfig(obj) {
  const configFiles = ZConfigFiles.parse(obj);
  const result = {};
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
var ZConfigFiles = z2.array(z2.object({
  name: z2.string(),
  contents: z2.string()
}));
var plistConfigFileName = "Config.plist";
var jsonConfigFileName = "Config.json";
var yamlConfigFileName = "Config.yaml";
var configFileNames = [
  plistConfigFileName,
  jsonConfigFileName,
  yamlConfigFileName
];
export {
  transform,
  standardizeKey,
  standardizeConfig,
  loadStaticConfig,
  configFromText
};
