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
boolean as boolean2,
intersect,
literal,
maxLength,
merge,
minLength,
minValue,
nonOptional,
null_,
number as number2,
object as object3,
optional as optional2,
parse as parse4,
record as record2,
regex,
safeInteger,
string as string3,
transform as transform2,
union as union2
} from "valibot";

// src/icon.ts
import {kebabCase} from "case-anything";
import emojiRegex from "emoji-regex";
import * as v from "valibot";

// src/log.ts
function log(...args) {
  if (typeof print === "function") {
    print(...args);
  } else if (typeof console === "object" && typeof console.log === "function") {
    console.log(...args);
  }
}

// src/icon.ts
function isSingleEmoji(string3) {
  return r.test(string3);
}
var renderModifier = function(key, value) {
  key = kebabCase(key);
  if (key === "shape" && typeof value === "string") {
    return SHAPE_NAMES.includes(value) ? value : "";
  }
  if (typeof value === "boolean")
    return value ? key : `${key}=0`;
  if (typeof value === "number")
    return `${key}=${value.toString()}`;
  if (typeof value === "string")
    return `${key}=${value}`;
  return "";
};
var descriptorStringFromComponents = function({
  prefix,
  payload,
  modifiers
}) {
  const modifierString = Object.entries(modifiers).map(([key, value]) => renderModifier(key, value)).filter((x) => x.length > 0).join(" ");
  return `${modifierString} ${prefix}:${payload}`.trim();
};
function standardizeIcon(specifier, extraParams) {
  const parsed = parseDescriptorString(specifier);
  if (!parsed.ok) {
    return parsed;
  }
  for (const shape of SHAPE_NAMES) {
    if (parsed.modifiers?.[shape]) {
      parsed.modifiers.shape = shape;
      delete parsed.modifiers[shape];
    }
  }
  const merged = v.parse(IconParamsSchema, {
    ...parsed.modifiers,
    ...standardizeConfig(extraParams)
  });
  for (const [key, value] of Object.entries(merged)) {
    if (value === defaultModifierValues.get(key)) {
      delete merged[key];
    }
  }
  parsed.modifiers = merged;
  return {
    specifier: descriptorStringFromComponents(parsed),
    ...parsed
  };
}
var parseDescriptorString = function(string3) {
  string3 = string3.trim();
  {
    const components2 = string3.match(/^(?:text:)?\[\[(.{1,3})\]\]$/);
    if (components2)
      string3 = `square filled ${components2[1]}`;
  }
  {
    const components2 = string3.match(/^text:((?:[a-z]{2,10} )+)(\S{1,3}|\S \S)/);
    if (components2)
      string3 = `${components2[1]}text:${components2[2]}`;
  }
  {
    const components2 = string3.match(/^[^:]+\.(svg|png)$/i);
    if (components2)
      string3 = `file:${components2[0]}`;
  }
  if (isSingleEmoji(string3)) {
    log("single emoji detected");
    return {
      ok: true,
      prefix: "text",
      payload: string3,
      modifiers: {}
    };
  }
  const components = string3.match(/^((?:[0-9a-z_=+-]+ +)*)(\S{1,3}|\S \S|[a-z]+:.*)$/i);
  if (!components) {
    return {
      ok: false,
      error: `invalid icon descriptor: '${string3}'`
    };
  }
  const modifiers = parseModifierString(components[1].trim());
  let specifier = components[2];
  if (specifier.length <= 3) {
    specifier = `text:${specifier}`;
  }
  const match = specifier.match(/^([a-z_]+):(.*)$/i);
  if (!match) {
    return {
      ok: false,
      error: `invalid icon specifier: '${specifier}'`
    };
  }
  const prefix = match[1];
  const payload = match[2];
  return { ok: true, prefix, payload, modifiers };
};
var parseModifierString = function(modifiers) {
  const result = {};
  if (modifiers.length > 0) {
    for (const str of modifiers.split(" ")) {
      const regex = /^([a-z_-]+)(?:=([+-]?[0-9a-z]{0,6}))?$/i;
      const components = str.match(regex);
      if (components && components.length === 3) {
        result[standardizeKey(components[1])] = components[2] ?? true;
      }
    }
  }
  return result;
};
log("ereg", JSON.stringify(emojiRegex, null, 2));
var r = new RegExp("^(" + emojiRegex().source + ")$");
var NumberAsString = v.union([
  v.number(),
  v.transform(v.string(), (x) => Number(x))
]);
var BooleanAsString = v.union([
  v.boolean(),
  v.transform(v.string(), (x) => x === "" || x === "1")
]);
var SHAPE_NAMES = ["search", "circle", "square"];
var IconParamsSchema = v.object({
  "preserve color": v.optional(BooleanAsString, undefined),
  "preserve aspect": v.optional(BooleanAsString, undefined),
  shape: v.optional(v.picklist(SHAPE_NAMES), undefined),
  filled: v.optional(BooleanAsString, false),
  strike: v.optional(BooleanAsString, false),
  monospaced: v.optional(BooleanAsString, false),
  "flip x": v.optional(BooleanAsString, false),
  "flip y": v.optional(BooleanAsString, false),
  "move x": v.optional(NumberAsString, 0),
  "move y": v.optional(NumberAsString, 0),
  scale: v.optional(NumberAsString, 100),
  rotate: v.optional(NumberAsString, 0)
});
var defaultModifierValues = new Map(Object.entries(v.getDefaults(IconParamsSchema)));

// src/validate.ts
function validateStaticConfig(config2) {
  try {
    const result = parse4(ExtensionSchema, config2);
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
var SaneStringSchema = string3([minLength(1), maxLength(500)]);
var SaneStringSchemaAllowingEmpty = string3([maxLength(500)]);
var StringTableSchema = intersect([
  record2(SaneStringSchema, SaneStringSchema),
  object3({
    en: nonOptional(SaneStringSchema, "An 'en' string is required")
  })
]);
var LocalizableStringSchema = transform2(union2([SaneStringSchema, StringTableSchema]), (value) => typeof value === "string" ? { en: value } : value);
var IdentifierSchema = string3([
  minLength(1),
  maxLength(100),
  regex(/^[a-z0-9]+([._-]?[a-z0-9]+)*$/i, "Invalid identifier")
]);
var VersionNumberSchema = number2("Must be a number", [
  safeInteger("Must be an integer"),
  minValue(1)
]);
var VersionStringSchema = string3("Must be a string", [
  regex(/^[0-9]+(\.[0-9]+)(\.[0-9]+)?$/, `Bad format`)
]);
var ModuleSchema = union2([SaneStringSchema, literal(true)]);
var EntitlementsSchema = array2(SaneStringSchema);
var AppSchema = object3({
  name: nonOptional(SaneStringSchema, "A name is required"),
  link: nonOptional(string3(), "A link is required"),
  "check installed": optional2(boolean2()),
  "bundle identifier": optional2(SaneStringSchema),
  "bundle identifiers": optional2(array2(SaneStringSchema))
});
var OptionsSchema = object3({
  identifier: nonOptional(SaneStringSchema),
  type: nonOptional(SaneStringSchema),
  label: optional2(LocalizableStringSchema),
  description: optional2(LocalizableStringSchema),
  values: optional2(array2(SaneStringSchemaAllowingEmpty)),
  "value labels": optional2(array2(LocalizableStringSchema)),
  "default value": optional2(union2([SaneStringSchemaAllowingEmpty, boolean2()])),
  icon: optional2(string3()),
  hidden: optional2(boolean2()),
  inset: optional2(boolean2())
});
var KeyComboSchema = union2([
  number2(),
  SaneStringSchema,
  object3({
    "key code": optional2(number2()),
    "key char": optional2(string3([minLength(1), maxLength(1)])),
    modifiers: nonOptional(number2())
  })
]);
var ActionSchema = merge([
  IconParamsSchema,
  object3({
    title: optional2(LocalizableStringSchema),
    icon: optional2(union2([string3(), null_(), literal(false)])),
    identifier: optional2(IdentifierSchema),
    app: optional2(AppSchema),
    apps: optional2(array2(AppSchema)),
    "capture html": optional2(boolean2()),
    "capture rtf": optional2(boolean2()),
    "stay visible": optional2(boolean2()),
    "restore pasteboard": optional2(boolean2()),
    requirements: optional2(array2(SaneStringSchema)),
    "required apps": optional2(array2(SaneStringSchema)),
    "excluded apps": optional2(array2(SaneStringSchema)),
    regex: optional2(string3()),
    before: optional2(SaneStringSchema),
    after: optional2(SaneStringSchema),
    permissions: optional2(array2(SaneStringSchema)),
    "service name": optional2(string3()),
    url: optional2(SaneStringSchema),
    "alternate url": optional2(SaneStringSchema),
    "clean query": optional2(boolean2()),
    "key combo": optional2(KeyComboSchema),
    "key combos": optional2(array2(KeyComboSchema)),
    applescript: optional2(string3()),
    "applescript file": optional2(string3()),
    "applescript call": optional2(object3({
      file: optional2(SaneStringSchema),
      handler: nonOptional(SaneStringSchema),
      parameters: optional2(array2(SaneStringSchema))
    })),
    "shell script": optional2(string3()),
    "shell script file": optional2(SaneStringSchema),
    interpreter: optional2(SaneStringSchema),
    stdin: optional2(SaneStringSchema),
    javascript: optional2(string3()),
    "javascript file": optional2(string3()),
    "shortcut name": optional2(string3())
  })
]);
var ExtensionSchema = merge([
  object3({
    name: nonOptional(LocalizableStringSchema, "A name is required"),
    "popclip version": optional2(VersionNumberSchema),
    "macos version": optional2(VersionStringSchema),
    entitlements: optional2(EntitlementsSchema),
    module: optional2(ModuleSchema),
    language: optional2(SaneStringSchema),
    action: optional2(ActionSchema),
    actions: optional2(array2(ActionSchema)),
    options: optional2(array2(OptionsSchema)),
    "options title": optional2(LocalizableStringSchema),
    "options script file": optional2(SaneStringSchema),
    description: optional2(LocalizableStringSchema)
  }),
  ActionSchema
]);
export {
  validateStaticConfig,
  standardizeKey,
  standardizeIcon,
  standardizeConfig,
  loadStaticConfig,
  isSingleEmoji,
  configFromText
};
