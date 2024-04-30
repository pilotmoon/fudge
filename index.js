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

// src/valibotIssues.ts
function formatValiIssues(issues) {
  const messages = [];
  for (const issue of issues) {
    const fmt = formatValiIssue(issue);
    if (fmt) {
      messages.push(`${fmt.dotPath}: ${fmt.message}`);
    }
  }
  return messages.join("\n");
}
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

// src/icon.ts
function isSingleEmoji(string2) {
  return r.test(string2);
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
function descriptorStringFromComponents(components) {
  const { prefix, payload, modifiers } = components;
  const modifierString = Object.entries(modifiers).map(([key, value]) => renderModifier(key, value)).filter((x) => x.length > 0).join(" ");
  return `${modifierString} ${prefix}:${payload}`.trim();
}
function standardizeIcon(specifier, extraParams) {
  const parsed = parseDescriptorString(specifier);
  if (!parsed.ok) {
    return parsed;
  }
  for (const shape of SHAPE_NAMES) {
    if (parsed.result.modifiers?.[shape]) {
      parsed.result.modifiers.shape = shape;
      delete parsed.result.modifiers[shape];
    }
  }
  const validated = v.safeParse(IconModifiersSchema, {
    ...parsed.result.modifiers,
    ...standardizeConfig(extraParams)
  });
  if (!validated.success) {
    return {
      ok: false,
      error: `invalid modifiers: ${formatValiIssues(validated.issues)}`
    };
  }
  for (const [key, value] of Object.entries(validated.output)) {
    if (value === defaultModifierValues.get(key)) {
      delete validated.output[key];
    }
  }
  parsed.result.modifiers = validated.output;
  return parsed;
}
var parseDescriptorString = function(string2) {
  string2 = string2.trim();
  {
    const components2 = string2.match(/^(?:text:)?\[\[(.{1,3})\]\]$/);
    if (components2)
      string2 = `square filled ${components2[1]}`;
  }
  {
    const components2 = string2.match(/^text:((?:[a-z]{2,10} )+)(\S{1,3}|\S \S)/);
    if (components2)
      string2 = `${components2[1]}text:${components2[2]}`;
  }
  {
    const components2 = string2.match(/^[^:]+\.(svg|png)$/i);
    if (components2)
      string2 = `file:${components2[0]}`;
  }
  if (isSingleEmoji(string2)) {
    log("single emoji detected");
    return {
      ok: true,
      result: {
        prefix: "text",
        payload: string2,
        modifiers: {}
      }
    };
  }
  const components = string2.match(/^((?:[0-9a-z_=+-]+ +)*)(\S{1,3}|\S \S|[a-z]+:.*)$/is);
  if (!components) {
    return {
      ok: false,
      error: `invalid icon string: '${string2}'`
    };
  }
  const modifiers = parseModifierString(components[1].trim());
  let specifier = components[2];
  if (specifier.length <= 3) {
    specifier = `text:${specifier}`;
  }
  const match = specifier.match(/^([a-z_]+):(.*)$/is);
  if (!match) {
    return {
      ok: false,
      error: `invalid icon specifier: '${specifier}'`
    };
  }
  const prefix = match[1];
  const payload = match[2];
  return {
    ok: true,
    result: {
      prefix,
      payload,
      modifiers
    }
  };
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
var r = new RegExp("^(" + emojiRegex().source + ")$");
var IntegerFromString = v.union([
  v.number([v.safeInteger()]),
  v.transform(v.string(), (x) => Number(x), [v.safeInteger()])
]);
var BooleanFromString = v.union([
  v.boolean(),
  v.transform(v.string(), (x) => x === "" || x === "1")
]);
var SHAPE_NAMES = ["search", "circle", "square"];
var ICON_PARAM_DEFAULTS = {
  "preserve color": undefined,
  "preserve aspect": undefined,
  shape: undefined,
  filled: false,
  strike: false,
  monospaced: false,
  "flip x": false,
  "flip y": false,
  "move x": 0,
  "move y": 0,
  scale: 100,
  rotate: 0
};
var IconModifiersSchema = v.object({
  "preserve color": v.optional(BooleanFromString),
  "preserve aspect": v.optional(BooleanFromString),
  shape: v.optional(v.picklist(SHAPE_NAMES)),
  filled: v.optional(BooleanFromString),
  strike: v.optional(BooleanFromString),
  monospaced: v.optional(BooleanFromString),
  "flip x": v.optional(BooleanFromString),
  "flip y": v.optional(BooleanFromString),
  "move x": v.optional(IntegerFromString),
  "move y": v.optional(IntegerFromString),
  scale: v.optional(IntegerFromString),
  rotate: v.optional(IntegerFromString)
});
var defaultModifierValues = new Map(Object.entries(ICON_PARAM_DEFAULTS));
var IconComponentsSchema = v.object({
  prefix: v.string(),
  payload: v.string(),
  modifiers: v.object({}, v.unknown())
});
// src/loader.ts
import {array, object as object2, parse as parse2, string as string2} from "valibot";

// src/parsers.ts
import {parse as parsePlist} from "fast-plist";
import {JSON_SCHEMA, load as parseYaml} from "js-yaml";
import {ValiError, parse, record, unknown as unknown2} from "valibot";
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
var VConfigObject = record(unknown2());

// src/snippet.ts
function lines(string2) {
  return string2.split(/\r\n|\n|\r/);
}
var extractPrefixedBlock = function(string2, prefix) {
  const result = [];
  for (const line of lines(string2)) {
    if (line !== "" && (prefix === "" || line.startsWith(prefix))) {
      result.push(line.replace(prefix, ""));
    } else {
      break;
    }
  }
  return result.join("\n");
};
var candidateYaml = function(string2) {
  const components = string2.match(/([^\n]*)# ?popclip.+$/is);
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
      result = EmbedType.ExecutableShellScript;
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
var forceString = function(val) {
  return typeof val === "string" ? val : "";
};
function configFromText(text, suffix = "") {
  const yaml = candidateYaml(text);
  if (yaml === null) {
    return null;
  }
  if (hasTabsInBlock(yaml)) {
    throw new Error("Don't use tabs in YAML");
  }
  const config2 = standardizeConfig(parseYamlObject(yaml));
  const embedType = embedTypeFromText(text, yaml, config2);
  suffix = forceString(suffix);
  suffix ||= forceString(config2["suffix"]);
  suffix ||= forceString(suffixForEmbedType(embedType));
  const fileName = suffix ? `Config.${suffix}` : "Config";
  const isExecutable = isExecutableForEmbedType(embedType);
  return { config: config2, embedType, fileName, isExecutable };
}
var suffixForEmbedType = function(embedType) {
  switch (embedType) {
    case EmbedType.Yaml:
      return "yaml";
    case EmbedType.JavaScript:
    case EmbedType.JavaScriptModule:
      return "js";
    case EmbedType.TypeScript:
    case EmbedType.TypeScriptModule:
      return "ts";
    case EmbedType.AppleScript:
      return "applescript";
    default:
      return null;
  }
};
var isExecutableForEmbedType = function(embedType) {
  switch (embedType) {
    case EmbedType.ExecutableShellScript:
      return true;
    default:
      return false;
  }
};
var selfReferenceFieldNameForEmbedType = function(embedType) {
  switch (embedType) {
    case EmbedType.ShellScript:
    case EmbedType.ExecutableShellScript:
      return "shell script file";
    case EmbedType.JavaScript:
    case EmbedType.TypeScript:
      return "javascript file";
    case EmbedType.AppleScript:
      return "applescript file";
    case EmbedType.JavaScriptModule:
    case EmbedType.TypeScriptModule:
      return "module";
    case EmbedType.Yaml:
    case EmbedType.Unknown:
    default:
      return null;
  }
};
function loadSnippet(text, fileName) {
  try {
    const { config: config2, embedType } = configFromText(text) ?? {
      config: {},
      embedType: EmbedType.Unknown
    };
    const fieldName = selfReferenceFieldNameForEmbedType(embedType);
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
  EmbedType2["ExecutableShellScript"] = "executable shell script";
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
var VConfigFiles = array(object2({
  name: string2(),
  contents: string2()
}));
var plistConfigFileName = "Config.plist";
var jsonConfigFileName = "Config.json";
var yamlConfigFileName = "Config.yaml";
var configFileNames = [
  plistConfigFileName,
  jsonConfigFileName,
  yamlConfigFileName
];
// src/summary.ts
import {
array as array3,
object as object4,
optional as optional3,
parse as parse4,
picklist as picklist2,
record as record3,
unknown as unknown3
} from "valibot";

// src/validate.ts
import {
ValiError as ValiError2,
array as array2,
boolean as boolean2,
custom,
intersect,
literal,
maxLength,
maxValue,
merge,
minLength,
minValue,
nonOptional,
null_,
number as number2,
object as object3,
optional as optional2,
parse as parse3,
record as record2,
regex,
safeInteger as safeInteger2,
string as string3,
union as union2
} from "valibot";
function validateStaticConfig(config2) {
  try {
    return parse3(ExtensionSchema, config2);
  } catch (error) {
    if (error instanceof ValiError2) {
      throw new Error(formatValiIssues(error.issues));
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid base config: ${msg}`);
  }
}
var SaneStringSchema = string3([minLength(1), maxLength(500)]);
var SaneStringAllowingEmptySchema = string3([maxLength(500)]);
var LongStringSchema = string3([minLength(1), maxLength(1e4)]);
var StringTableSchema = intersect([
  record2(SaneStringSchema, SaneStringSchema),
  object3({
    en: nonOptional(SaneStringSchema, "An 'en' string is required")
  })
]);
var LocalizableStringSchema = union2([
  SaneStringSchema,
  StringTableSchema
]);
var IdentifierSchema = string3([
  minLength(1),
  maxLength(100),
  regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/i, "Invalid identifier (allowed: [a-zA-Z0-9]+, separated by [._-])")
]);
var VersionNumberSchema = number2("Must be a number", [
  safeInteger2("Must be an integer"),
  minValue(1)
]);
var VersionStringSchema = string3("Must be a string", [
  regex(/^[0-9]+(\.[0-9]+)(\.[0-9]+)?$/, `Bad format`)
]);
var IconSchema = union2([LongStringSchema, null_(), literal(false)]);
var AppSchema = object3({
  name: nonOptional(SaneStringSchema, "App name is required"),
  link: nonOptional(SaneStringSchema, "App link is required"),
  "check installed": optional2(boolean2()),
  "bundle identifier": optional2(SaneStringSchema),
  "bundle identifiers": optional2(array2(SaneStringSchema))
});
var OptionSchema = merge([
  object3({
    identifier: nonOptional(IdentifierSchema, "Option identifier is required"),
    type: nonOptional(SaneStringSchema, "Option type is required"),
    label: optional2(LocalizableStringSchema),
    description: optional2(LocalizableStringSchema),
    values: optional2(array2(SaneStringAllowingEmptySchema)),
    "value labels": optional2(array2(LocalizableStringSchema)),
    "default value": optional2(union2([SaneStringAllowingEmptySchema, boolean2()])),
    hidden: optional2(boolean2()),
    inset: optional2(boolean2()),
    icon: optional2(IconSchema)
  }),
  IconModifiersSchema
]);
var KeyCodeSchema = number2([safeInteger2(), minValue(0), maxValue(127)]);
var KeyComboSchema = union2([
  KeyCodeSchema,
  SaneStringSchema,
  object3({
    "key code": optional2(KeyCodeSchema),
    "key char": optional2(string3([minLength(1), maxLength(1)])),
    modifiers: nonOptional(number2([safeInteger2(), minValue(0)]), "'modifiers' is required")
  }, [
    custom((obj) => {
      const hasKeyCode = obj["key code"] !== undefined;
      const hasKeyChar = obj["key char"] !== undefined;
      return (hasKeyCode || hasKeyChar) && !(hasKeyCode && hasKeyChar);
    }, "One of 'key code' or 'key char' is required")
  ])
]);
var ActionCoreSchema = object3({
  title: optional2(LocalizableStringSchema),
  icon: optional2(IconSchema),
  identifier: optional2(IdentifierSchema)
});
var ActionFlagsSchema = object3({
  app: optional2(AppSchema),
  apps: optional2(array2(AppSchema)),
  "capture html": optional2(boolean2()),
  "capture rtf": optional2(boolean2()),
  "stay visible": optional2(boolean2()),
  "restore pasteboard": optional2(boolean2()),
  requirements: optional2(array2(SaneStringSchema)),
  "required apps": optional2(array2(SaneStringSchema)),
  "excluded apps": optional2(array2(SaneStringSchema)),
  regex: optional2(LongStringSchema),
  before: optional2(SaneStringSchema),
  after: optional2(SaneStringSchema),
  permissions: optional2(array2(SaneStringSchema))
});
var ServiceActionSchema = object3({
  "service name": optional2(SaneStringSchema)
});
var ShortcutActionSchema = object3({
  "shortcut name": optional2(SaneStringSchema)
});
var UrlActionSchema = object3({
  url: optional2(SaneStringSchema),
  "alternate url": optional2(SaneStringSchema),
  "clean query": optional2(boolean2())
});
var KeyComboActionSchema = object3({
  "key combo": optional2(KeyComboSchema),
  "key combos": optional2(array2(KeyComboSchema))
});
var AppleScriptActionSchema = object3({
  applescript: optional2(LongStringSchema),
  "applescript file": optional2(SaneStringSchema),
  "applescript call": optional2(object3({
    file: optional2(SaneStringSchema),
    handler: nonOptional(SaneStringSchema, "Handler name is required"),
    parameters: optional2(array2(SaneStringSchema))
  }))
});
var ShellScriptActionSchema = object3({
  "shell script": optional2(LongStringSchema),
  "shell script file": optional2(SaneStringSchema),
  interpreter: optional2(SaneStringSchema),
  stdin: optional2(SaneStringSchema)
});
var JavaScriptActionSchema = object3({
  javascript: optional2(LongStringSchema),
  "javascript file": optional2(SaneStringSchema)
});
var ActionSchema = merge([
  ActionCoreSchema,
  ActionFlagsSchema,
  IconModifiersSchema,
  ServiceActionSchema,
  ShortcutActionSchema,
  UrlActionSchema,
  KeyComboActionSchema,
  AppleScriptActionSchema,
  ShellScriptActionSchema,
  JavaScriptActionSchema
]);
var ExtensionCoreSchema = object3({
  name: nonOptional(LocalizableStringSchema, "A name is required"),
  icon: optional2(IconSchema),
  identifier: optional2(IdentifierSchema),
  "popclip version": optional2(VersionNumberSchema),
  "macos version": optional2(VersionStringSchema),
  entitlements: optional2(array2(SaneStringSchema)),
  module: optional2(union2([SaneStringSchema, literal(true)])),
  language: optional2(SaneStringSchema),
  action: optional2(ActionSchema),
  actions: optional2(array2(ActionSchema)),
  options: optional2(array2(OptionSchema)),
  "options title": optional2(LocalizableStringSchema),
  "options script file": optional2(null_("Not supported"))
});
var MetadataSchema = object3({
  description: optional2(LocalizableStringSchema),
  keywords: optional2(SaneStringSchema)
});
var ExtensionSchema = merge([
  ExtensionCoreSchema,
  ActionSchema,
  MetadataSchema
]);

// src/summary.ts
var extractLocalizedString = function(ls) {
  if (typeof ls === "string") {
    return ls;
  } else if (typeof ls?.en === "string") {
    return ls.en;
  }
};
function extractSummary(config2) {
  const actions = config2.actions ? config2.actions : config2.action ? [config2.action] : [];
  const icon3 = (() => {
    let parsedIcon;
    for (const obj of [config2, ...actions]) {
      if (obj.icon) {
        parsedIcon = standardizeIcon(obj.icon, obj);
        break;
      }
    }
    if (parsedIcon?.ok) {
      return parsedIcon.result;
    }
    return;
  })();
  const actionTypesSet = new Set;
  if (config2.module) {
    actionTypesSet.add("javascript");
  } else {
    for (const action of [...actions, config2]) {
      for (const [type, keys] of Object.entries(SENTINEL_KEYS)) {
        if (keys.some((key) => action.hasOwnProperty(key))) {
          actionTypesSet.add(type);
          break;
        }
      }
    }
  }
  if (actionTypesSet.size === 0 && actions.length > 0) {
    actionTypesSet.add("none");
  }
  const actionTypes = Array.from(actionTypesSet);
  const apps = [];
  for (const obj of [config2, ...actions]) {
    if (obj.apps) {
      for (const app of obj.apps) {
        apps.push({ name: app.name, link: app.link });
      }
    } else if (obj.app) {
      apps.push({ name: obj.app.name, link: obj.app.link });
    }
  }
  return parse4(ExtensionsSummarySchema, {
    name: extractLocalizedString(config2.name),
    actionTypes,
    identifier: config2.identifier,
    description: extractLocalizedString(config2.description),
    keywords: config2.keywords,
    icon: icon3,
    entitlements: config2.entitlements?.length ? config2.entitlements : undefined,
    apps: apps.length ? apps : undefined,
    macosVersion: config2["macos version"],
    popclipVersion: config2["popclip version"]
  });
}
var SENTINEL_KEYS = {
  service: ["service name"],
  url: ["url"],
  keypress: ["key combo", "key combos"],
  applescript: ["applescript", "applescript file", "applescript call"],
  shellscript: ["shell script", "shell script file"],
  javascript: ["javascript", "javascript file"],
  shortcut: ["shortcut name"],
  none: []
};
var ActionTypeSchema = picklist2(Object.keys(SENTINEL_KEYS));
var ExtensionsSummarySchema = object4({
  name: SaneStringSchema,
  identifier: optional3(SaneStringSchema),
  description: optional3(SaneStringSchema),
  keywords: optional3(SaneStringSchema),
  icon: optional3(object4({
    prefix: SaneStringSchema,
    payload: SaneStringSchema,
    modifiers: record3(unknown3())
  })),
  actionTypes: array3(ActionTypeSchema),
  entitlements: optional3(array3(SaneStringSchema)),
  apps: optional3(array3(object4({ name: SaneStringSchema, link: SaneStringSchema }))),
  macosVersion: optional3(SaneStringSchema),
  popclipVersion: optional3(VersionNumberSchema)
});
export {
  validateStaticConfig,
  standardizeKey,
  standardizeIcon,
  standardizeConfig,
  loadStaticConfig,
  isSingleEmoji,
  extractSummary,
  descriptorStringFromComponents,
  configFromText
};
