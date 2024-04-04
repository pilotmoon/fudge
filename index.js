// src/loader.ts
import {array, object, parse as parse2, string} from "valibot";

// src/parsers.ts
import {parse as parsePlist} from "fast-plist";
import {JSON_SCHEMA, load as parseYaml} from "js-yaml";
import {ValiError, parse, record, unknown} from "valibot";
function parsePlistObject(plist) {
  try {
    return parse(VConfigObject, parsePlist(plist.replace(/<key>Credits<\/key>\s*<array>[\s\S]*?<\/array>/, "")));
  } catch (e) {
    if (e instanceof ValiError) {
      throw new Error(`Invalid config: ${e.message}`);
    }
    if (e instanceof Error) {
      throw new Error(`Invalid plist: ${e.message}`);
    }
    throw new Error("Invalid plist");
  }
}
function parseJsonObject(jsonSource) {
  try {
    return parse(VConfigObject, JSON.parse(jsonSource));
  } catch (e) {
    if (e instanceof ValiError) {
      throw new Error(`Invalid config: ${e.message}`);
    }
    if (e instanceof Error) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    throw new Error("Invalid JSON");
  }
}
function parseYamlObject(yamlSource) {
  try {
    return parse(VConfigObject, parseYaml(yamlSource, { schema: JSON_SCHEMA }));
  } catch (e) {
    if (e instanceof ValiError) {
      throw new Error(`Invalid config: ${e.message}`);
    }
    if (e instanceof Error) {
      throw new Error(`Invalid YAML: ${e.message}`);
    }
    throw new Error("Invalid YAML");
  }
}
var VConfigObject = record(unknown());

// src/std.ts
import {lowerCase} from "case-anything";

// src/config.ts
function transformConfig(val, fn) {
  if (typeof val !== "object" || val === null)
    return val;
  const result = {};
  for (const [key, obj] of Object.entries(val)) {
    if (Array.isArray(obj)) {
      result[fn(key)] = obj.map((item) => transformConfig(item, fn));
    } else {
      result[fn(key)] = transformConfig(obj, fn);
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
  params: "parameters",
  id: "identifier"
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
  return transformConfig(config2, standardizeKey);
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
  if (!/name\"\s*:|name:\s+/is.test(candidateYaml2)) {
    return null;
  }
  return candidateYaml2.replace(/\u00A0/g, " ").trim();
};
var embedTypeFromText = function(text, yaml, config2) {
  let result = EmbedType.Unknown;
  let { module, language, interpreter } = config2;
  if (typeof module === "string") {
    throw new Error("In a snippet, 'module' must be a boolean");
  }
  module = typeof module === "boolean" ? module : false;
  language = typeof language === "string" ? standardizeKey(language) : "";
  interpreter = typeof interpreter === "string" ? interpreter : "";
  if (module && !language) {
    throw new Error("A 'language' is needed with 'module'");
  }
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
    const msg = error instanceof Error && error.message ? error.message : "Invalid snippet";
    throw new Error(msg);
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
  const configFiles = parse2(VConfigFiles, obj);
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
var VConfigFiles = array(object({
  name: string(),
  contents: string()
}));
var plistConfigFileName = "Config.plist";
var jsonConfigFileName = "Config.json";
var yamlConfigFileName = "Config.yaml";
var configFileNames = [
  plistConfigFileName,
  jsonConfigFileName,
  yamlConfigFileName
];
// src/validate.ts
import {
ValiError as ValiError2,
array as array2,
intersect,
literal,
maxLength,
merge,
minLength,
minValue,
nonOptional,
null_,
number,
object as object2,
optional,
parse as parse3,
record as record2,
regex,
safeInteger,
string as string2,
transform,
union
} from "valibot";
function validateStaticConfig(config2) {
  try {
    const result = parse3(ExtensionSchema, config2);
    return result;
  } catch (error) {
    if (error instanceof ValiError2) {
      throw new Error(formatValiError(error));
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid base config: ${msg}`);
  }
}
var formatValiError = function(error) {
  const messages = [];
  for (const issue of error.issues) {
    const fmt = formatValiIssue(issue);
    if (fmt) {
      messages.push(`${fmt.dotPath}: ${fmt.message}`);
    }
  }
  return messages.join("\n");
};
var formatValiIssue = function(issue) {
  const dotPath = issue.path?.map((item) => item.key).join(".") ?? "";
  if (Array.isArray(issue.issues) && issue.issues.length > 0) {
    const fmt = formatValiIssue(issue.issues?.find((item) => item?.path?.length ?? 0) ?? issue.issues[0]);
    fmt.dotPath = fmt.dotPath ? `${dotPath}.${fmt.dotPath}` : dotPath;
    return fmt;
  }
  const message = `${issue.message} (value: ${JSON.stringify(issue.input)})`;
  return { dotPath, message };
};
var SaneStringSchema = string2([minLength(1), maxLength(500)]);
var NullOrFalseSchema = union([null_(), literal(false)]);
var StringTableSchema = intersect([
  record2(SaneStringSchema, SaneStringSchema),
  object2({
    en: nonOptional(SaneStringSchema, "An 'en' string is required")
  })
]);
var LocalizableStringSchema = transform(union([SaneStringSchema, StringTableSchema]), (value) => typeof value === "string" ? { en: value } : value);
var IdentifierSchema = string2([
  minLength(1),
  maxLength(100),
  regex(/^[a-z0-9]+([._-]?[a-z0-9]+)*$/i, "Invalid identifier")
]);
var VersionNumberSchema = number("Must be a number", [
  safeInteger("Must be an integer"),
  minValue(1)
]);
var VersionStringSchema = string2("Must be a string", [
  regex(/^[0-9]+(\.[0-9]+)(\.[0-9]+)?$/, `Bad format`)
]);
var ModuleSchema = union([SaneStringSchema, literal(true)]);
var EntitlementsSchema = array2(SaneStringSchema);
var AppSchema = object2({
  name: nonOptional(SaneStringSchema, "A name is required"),
  link: nonOptional(string2(), "A link is required")
});
var ActionSchema = object2({
  title: optional(LocalizableStringSchema),
  icon: optional(union([string2(), null_(), literal(false)])),
  app: optional(AppSchema),
  apps: optional(array2(AppSchema)),
  "service name": optional(string2()),
  url: optional(string2()),
  "key combo": optional(union([string2(), object2({})])),
  "key combos": optional(array2(string2())),
  applescript: optional(string2()),
  "applescript file": optional(string2()),
  "applescript call": optional(object2({})),
  "shell script": optional(string2()),
  "shell script file": optional(string2()),
  javascript: optional(string2()),
  "javascript file": optional(string2()),
  "shortcut name": optional(string2())
});
var ExtensionSchema = merge([
  object2({
    name: nonOptional(LocalizableStringSchema, "A name is required"),
    identifier: optional(IdentifierSchema),
    "popclip version": optional(VersionNumberSchema),
    "macos version": optional(VersionStringSchema),
    module: optional(ModuleSchema),
    entitlements: optional(EntitlementsSchema),
    actions: optional(array2(ActionSchema)),
    description: optional(LocalizableStringSchema)
  }),
  ActionSchema
]);
export {
  validateStaticConfig,
  standardizeKey,
  standardizeConfig,
  loadStaticConfig,
  configFromText
};
