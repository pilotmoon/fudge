// src/icon.ts
import { kebabCase } from "case-anything";
import emojiRegex from "emoji-regex";
import * as v2 from "valibot";

// src/log.ts
function log(...args) {
  if (typeof print === "function") {
    print(...args);
  } else if (typeof console === "object" && typeof console.log === "function") {
    console.log(...args);
  }
}

// src/std.ts
import { lowerCase } from "case-anything";

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
function standardizeConfig(config) {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Cannot standardize that");
  }
  return transformConfig(config, standardizeKey);
}

// src/valibotIssues.ts
import * as v from "valibot";
function formatValiIssues(issues) {
  const messages = [];
  for (const issue of issues) {
    const fmt = formatValiIssue(issue);
    if (fmt) {
      messages.push(`${fmt.dotPath}: ${fmt.message}`);
    }
  }
  return messages.join(`
`);
}
function formatValiIssue(issue) {
  const dotPath = v.getDotPath(issue);
  const message = `${issue.message} (value: ${JSON.stringify(issue.input)})`;
  if (typeof dotPath !== "string") {
    return { dotPath: "", message };
  }
  if (Array.isArray(issue.issues) && issue.issues.length > 0) {
    const fmt = formatValiIssue(issue.issues?.find((item) => item?.path?.length ?? 0) ?? issue.issues[0]);
    fmt.dotPath = fmt.dotPath ? `${dotPath}.${fmt.dotPath}` : dotPath;
    return fmt;
  }
  return { dotPath, message };
}

// src/icon.ts
var r = new RegExp("^(" + emojiRegex().source + ")$");
function isSingleEmoji(string2) {
  return r.test(string2);
}
var IntegerFromString = v2.union([
  v2.pipe(v2.number(), v2.safeInteger()),
  v2.pipe(v2.string(), v2.transform((x) => Number(x)), v2.safeInteger())
]);
var BooleanFromString = v2.union([
  v2.boolean(),
  v2.pipe(v2.string(), v2.transform((x) => x === "" || x === "1"))
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
var IconModifiersSchema = v2.object({
  "preserve color": v2.optional(BooleanFromString),
  "preserve aspect": v2.optional(BooleanFromString),
  shape: v2.optional(v2.picklist(SHAPE_NAMES)),
  filled: v2.optional(BooleanFromString),
  strike: v2.optional(BooleanFromString),
  monospaced: v2.optional(BooleanFromString),
  "flip x": v2.optional(BooleanFromString),
  "flip y": v2.optional(BooleanFromString),
  "move x": v2.optional(IntegerFromString),
  "move y": v2.optional(IntegerFromString),
  scale: v2.optional(IntegerFromString),
  rotate: v2.optional(IntegerFromString)
});
var defaultModifierValues = new Map(Object.entries(ICON_PARAM_DEFAULTS));
var IconComponentsSchema = v2.object({
  prefix: v2.string(),
  payload: v2.string(),
  modifiers: v2.looseObject({})
});
function renderModifier(key, value) {
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
}
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
  const validated = v2.safeParse(IconModifiersSchema, {
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
function parseDescriptorString(string2) {
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
}
function parseModifierString(modifiers) {
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
}
// src/loader.ts
import * as v4 from "valibot";

// src/parsers.ts
import { parse as parsePlist } from "fast-plist";
import { JSON_SCHEMA, load as parseYaml } from "js-yaml";
import * as v3 from "valibot";
var VConfigObject = v3.record(v3.string(), v3.unknown());
function parsePlistObject(plist) {
  try {
    return v3.parse(VConfigObject, parsePlist(plist.replace(/<key>Credits<\/key>\s*<array>[\s\S]*?<\/array>/, "")));
  } catch (e) {
    if (e instanceof v3.ValiError) {
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
    return v3.parse(VConfigObject, JSON.parse(jsonSource));
  } catch (e) {
    if (e instanceof v3.ValiError) {
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
    return v3.parse(VConfigObject, parseYaml(yamlSource, { schema: JSON_SCHEMA }));
  } catch (e) {
    if (e instanceof v3.ValiError) {
      throw new Error(`Invalid config: ${e.message}`);
    }
    if (e instanceof Error) {
      throw new Error(`Invalid YAML: ${e.message}`);
    }
    throw new Error("Invalid YAML");
  }
}

// src/snippet.ts
function lines(string3) {
  return string3.split(/\r\n|\n|\r/);
}
function extractPrefixedBlock(string3, prefix) {
  const result = [];
  for (const line of lines(string3)) {
    if (line !== "" && (prefix === "" || line.startsWith(prefix))) {
      result.push(line.replace(prefix, ""));
    } else {
      break;
    }
  }
  return result.join(`
`);
}
function candidateYaml(string3) {
  const components = string3.match(/([^\n]*)# ?popclip.+$/is);
  if (components?.length !== 2) {
    return null;
  }
  const candidateYaml2 = extractPrefixedBlock(components[0], components[1]);
  if (!/name"\s*:|name:\s+/is.test(candidateYaml2)) {
    return null;
  }
  return candidateYaml2.replace(/\u00A0/g, " ").trim();
}
function embedTypeFromText(text, yaml, config) {
  let result = "unknown" /* Unknown */;
  let { module, language, interpreter } = config;
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
        result = "javascript module" /* JavaScriptModule */;
      } else {
        result = "javascript" /* JavaScript */;
      }
    } else if (language === "typescript") {
      if (module) {
        result = "typescript module" /* TypeScriptModule */;
      } else {
        result = "typescript" /* TypeScript */;
      }
    } else if (language === "applescript") {
      result = "applescript" /* AppleScript */;
    } else if (interpreter.length > 0) {
      result = "shell script" /* ShellScript */;
    } else if (text.startsWith("#!")) {
      result = "executable shell script" /* ExecutableShellScript */;
    }
  } else {
    result = "yaml" /* Yaml */;
  }
  return result;
}
function hasTabsInBlock(yamlSource) {
  for (const line of lines(yamlSource)) {
    const parts = line.split("{");
    if (parts[0].includes("\t"))
      return true;
    if (parts.length > 1)
      break;
  }
  return false;
}
function forceString(val) {
  return typeof val === "string" ? val : "";
}
function configFromText(text, externalSuffix = "") {
  const yaml = candidateYaml(text);
  if (yaml === null) {
    return null;
  }
  if (hasTabsInBlock(yaml)) {
    throw new Error("Don't use tabs in YAML");
  }
  const config = standardizeConfig(parseYamlObject(yaml));
  const embedType = embedTypeFromText(text, yaml, config);
  let suffix = forceString(suffixForEmbedType(embedType));
  suffix ||= forceString(externalSuffix);
  suffix ||= forceString(config["suffix"]);
  log("suffix", suffix);
  const fileName = suffix ? `Config.${suffix}` : "Config";
  const isExecutable = isExecutableForEmbedType(embedType);
  return { config, embedType, fileName, isExecutable };
}
function suffixForEmbedType(embedType) {
  switch (embedType) {
    case "yaml" /* Yaml */:
      return "yaml";
    case "javascript" /* JavaScript */:
    case "javascript module" /* JavaScriptModule */:
      return "js";
    case "typescript" /* TypeScript */:
    case "typescript module" /* TypeScriptModule */:
      return "ts";
    case "applescript" /* AppleScript */:
      return "applescript";
    default:
      return null;
  }
}
function isExecutableForEmbedType(embedType) {
  switch (embedType) {
    case "executable shell script" /* ExecutableShellScript */:
      return true;
    default:
      return false;
  }
}
function selfReferenceFieldNameForEmbedType(embedType) {
  switch (embedType) {
    case "shell script" /* ShellScript */:
    case "executable shell script" /* ExecutableShellScript */:
      return "shell script file";
    case "javascript" /* JavaScript */:
    case "typescript" /* TypeScript */:
      return "javascript file";
    case "applescript" /* AppleScript */:
      return "applescript file";
    case "javascript module" /* JavaScriptModule */:
    case "typescript module" /* TypeScriptModule */:
      return "module";
    case "yaml" /* Yaml */:
    case "unknown" /* Unknown */:
    default:
      return null;
  }
}
function loadSnippet(text, fileName) {
  try {
    const { config, embedType } = configFromText(text) ?? {
      config: {},
      embedType: "unknown" /* Unknown */
    };
    const fieldName = selfReferenceFieldNameForEmbedType(embedType);
    if (fieldName) {
      config[fieldName] = fileName;
    }
    return config;
  } catch (error) {
    const msg = error instanceof Error && error.message ? error.message : "Invalid snippet";
    throw new Error(msg);
  }
}

// src/loader.ts
var VConfigFiles = v4.array(v4.object({
  name: v4.string(),
  contents: v4.string()
}));
var plistConfigFileName = "Config.plist";
var jsonConfigFileName = "Config.json";
var yamlConfigFileName = "Config.yaml";
var configFileNames = [
  plistConfigFileName,
  jsonConfigFileName,
  yamlConfigFileName
];
function loadStaticConfig(obj) {
  const configFiles = v4.parse(VConfigFiles, obj);
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
// src/summary.ts
import * as v6 from "valibot";

// src/validate.ts
import * as v5 from "valibot";
var SaneStringSchema = v5.pipe(v5.string(), v5.minLength(1), v5.maxLength(500));
var SaneStringAllowingEmptySchema = v5.pipe(v5.string(), v5.maxLength(500));
var LongStringSchema = v5.pipe(v5.string(), v5.minLength(1), v5.maxLength(1e4));
var StringTableSchema = v5.intersect([
  v5.record(SaneStringSchema, SaneStringSchema),
  v5.object({
    en: v5.nonOptional(SaneStringSchema, "An 'en' string is required")
  })
]);
var LocalizableStringSchema = v5.union([
  SaneStringSchema,
  StringTableSchema
]);
var IdentifierSchema = v5.pipe(v5.string(), v5.minLength(1), v5.maxLength(100), v5.regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/i, "Invalid identifier (allowed: [a-zA-Z0-9]+, separated by [._-])"));
var VersionNumberSchema = v5.pipe(v5.number("Must be a number"), v5.safeInteger("Must be an integer"), v5.minValue(1));
var VersionStringSchema = v5.pipe(v5.string("Must be a string"), v5.regex(/^[0-9]+(\.[0-9]+)(\.[0-9]+)?$/, "Bad format"));
var IconSchema = v5.union([LongStringSchema, v5.null_(), v5.literal(false)]);
var AppSchema = v5.object({
  name: v5.nonOptional(SaneStringSchema, "App name is required"),
  link: v5.nonOptional(SaneStringSchema, "App link is required"),
  "check installed": v5.optional(v5.boolean()),
  "bundle identifier": v5.optional(SaneStringSchema),
  "bundle identifiers": v5.optional(v5.array(SaneStringSchema))
});
var OptionSchema = v5.object({
  identifier: v5.nonOptional(IdentifierSchema, "Option identifier is required"),
  type: v5.nonOptional(SaneStringSchema, "Option type is required"),
  label: v5.optional(LocalizableStringSchema),
  description: v5.optional(LocalizableStringSchema),
  values: v5.optional(v5.array(SaneStringAllowingEmptySchema)),
  "value labels": v5.optional(v5.array(LocalizableStringSchema)),
  "default value": v5.optional(v5.union([SaneStringAllowingEmptySchema, v5.boolean()])),
  hidden: v5.optional(v5.boolean()),
  inset: v5.optional(v5.boolean()),
  icon: v5.optional(IconSchema),
  ...IconModifiersSchema.entries
});
var KeyCodeSchema = v5.pipe(v5.number(), v5.safeInteger(), v5.minValue(0), v5.maxValue(127));
var KeyComboSchema = v5.union([
  KeyCodeSchema,
  SaneStringSchema,
  v5.pipe(v5.object({
    "key code": v5.optional(KeyCodeSchema),
    "key char": v5.optional(v5.pipe(v5.string(), v5.minLength(1), v5.maxLength(1))),
    modifiers: v5.nonOptional(v5.pipe(v5.number(), v5.safeInteger(), v5.minValue(0)), "'modifiers' is required")
  }), v5.check((obj) => {
    const hasKeyCode = obj["key code"] !== undefined;
    const hasKeyChar = obj["key char"] !== undefined;
    return (hasKeyCode || hasKeyChar) && !(hasKeyCode && hasKeyChar);
  }, "One of 'key code' or 'key char' is required"))
]);
var ActionCoreSchema = v5.object({
  title: v5.optional(LocalizableStringSchema),
  icon: v5.optional(IconSchema),
  identifier: v5.optional(IdentifierSchema)
});
var ActionFlagsSchema = v5.object({
  app: v5.optional(AppSchema),
  apps: v5.optional(v5.array(AppSchema)),
  "capture html": v5.optional(v5.boolean()),
  "capture rtf": v5.optional(v5.boolean()),
  "stay visible": v5.optional(v5.boolean()),
  "restore pasteboard": v5.optional(v5.boolean()),
  requirements: v5.optional(v5.array(SaneStringSchema)),
  "required apps": v5.optional(v5.array(SaneStringSchema)),
  "excluded apps": v5.optional(v5.array(SaneStringSchema)),
  regex: v5.optional(LongStringSchema),
  before: v5.optional(SaneStringSchema),
  after: v5.optional(SaneStringSchema),
  permissions: v5.optional(v5.array(SaneStringSchema))
});
var ServiceActionSchema = v5.object({
  "service name": v5.optional(SaneStringSchema)
});
var ShortcutActionSchema = v5.object({
  "shortcut name": v5.optional(SaneStringSchema)
});
var UrlActionSchema = v5.object({
  url: v5.optional(SaneStringSchema),
  "alternate url": v5.optional(SaneStringSchema),
  "clean query": v5.optional(v5.boolean())
});
var KeyComboActionSchema = v5.object({
  "key combo": v5.optional(KeyComboSchema),
  "key combos": v5.optional(v5.array(KeyComboSchema))
});
var AppleScriptActionSchema = v5.object({
  applescript: v5.optional(LongStringSchema),
  "applescript file": v5.optional(SaneStringSchema),
  "applescript call": v5.optional(v5.object({
    file: v5.optional(SaneStringSchema),
    handler: v5.nonOptional(SaneStringSchema, "Handler name is required"),
    parameters: v5.optional(v5.array(SaneStringSchema))
  }))
});
var ShellScriptActionSchema = v5.object({
  "shell script": v5.optional(LongStringSchema),
  "shell script file": v5.optional(SaneStringSchema),
  interpreter: v5.optional(SaneStringSchema),
  stdin: v5.optional(SaneStringSchema)
});
var JavaScriptActionSchema = v5.object({
  javascript: v5.optional(LongStringSchema),
  "javascript file": v5.optional(SaneStringSchema)
});
var ActionSchema = v5.object({
  ...ActionCoreSchema.entries,
  ...ActionFlagsSchema.entries,
  ...IconModifiersSchema.entries,
  ...ServiceActionSchema.entries,
  ...ShortcutActionSchema.entries,
  ...UrlActionSchema.entries,
  ...KeyComboActionSchema.entries,
  ...AppleScriptActionSchema.entries,
  ...ShellScriptActionSchema.entries,
  ...JavaScriptActionSchema.entries
});
var ExtensionCoreSchema = v5.object({
  name: v5.nonOptional(LocalizableStringSchema, "A name is required"),
  icon: v5.optional(IconSchema),
  identifier: v5.optional(IdentifierSchema),
  "popclip version": v5.optional(VersionNumberSchema),
  "macos version": v5.optional(VersionStringSchema),
  entitlements: v5.optional(v5.array(SaneStringSchema)),
  module: v5.optional(v5.union([SaneStringSchema, v5.literal(true)])),
  language: v5.optional(SaneStringSchema),
  action: v5.optional(ActionSchema),
  actions: v5.optional(v5.array(ActionSchema)),
  options: v5.optional(v5.array(OptionSchema)),
  "options title": v5.optional(LocalizableStringSchema),
  "options script file": v5.optional(SaneStringSchema)
});
var MetadataSchema = v5.object({
  description: v5.optional(LocalizableStringSchema),
  keywords: v5.optional(SaneStringSchema)
});
var ExtensionSchema = v5.object({
  ...ExtensionCoreSchema.entries,
  ...ActionSchema.entries,
  ...MetadataSchema.entries
});
function validateStaticConfig(config) {
  try {
    return v5.parse(ExtensionSchema, config);
  } catch (error) {
    if (error instanceof v5.ValiError) {
      throw new Error(formatValiIssues(error.issues));
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid base config: ${msg}`);
  }
}

// src/summary.ts
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
var ActionTypeSchema = v6.picklist(Object.keys(SENTINEL_KEYS));
var ExtensionsSummarySchema = v6.object({
  name: LocalizableStringSchema,
  identifier: v6.optional(SaneStringSchema),
  description: v6.optional(LocalizableStringSchema),
  keywords: v6.optional(SaneStringSchema),
  icon: v6.optional(IconComponentsSchema),
  actionTypes: v6.array(ActionTypeSchema),
  entitlements: v6.optional(v6.array(SaneStringSchema)),
  apps: v6.optional(v6.array(v6.object({ name: SaneStringSchema, link: SaneStringSchema }))),
  macosVersion: v6.optional(SaneStringSchema),
  popclipVersion: v6.optional(VersionNumberSchema)
});
function normalizeLocalizedString(ls) {
  return typeof ls === "object" && Object.entries(ls).length === 1 ? ls.en : ls;
}
function extractSummary(config) {
  const actions = config.actions ? config.actions : config.action ? [config.action] : [];
  const icon = (() => {
    let parsedIcon;
    for (const obj of [config, ...actions]) {
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
  if (config.module) {
    actionTypesSet.add("javascript");
  } else {
    for (const action of [...actions, config]) {
      for (const [type, keys] of Object.entries(SENTINEL_KEYS)) {
        if (keys.some((key) => Object.hasOwn(action, key))) {
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
  for (const obj of [config, ...actions]) {
    if (obj.apps) {
      for (const app of obj.apps) {
        apps.push({ name: app.name, link: app.link });
      }
    } else if (obj.app) {
      apps.push({ name: obj.app.name, link: obj.app.link });
    }
  }
  return v6.parse(ExtensionsSummarySchema, {
    name: normalizeLocalizedString(config.name),
    actionTypes,
    identifier: config.identifier,
    description: normalizeLocalizedString(config.description),
    keywords: config.keywords,
    icon,
    entitlements: config.entitlements?.length ? config.entitlements : undefined,
    apps: apps.length ? apps : undefined,
    macosVersion: config["macos version"],
    popclipVersion: config["popclip version"]
  });
}
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
