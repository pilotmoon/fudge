import { Config } from "./config.js";
import { log } from "./log.js";
import { parseYamlObject } from "./parsers.js";
import { standardizeConfig, standardizeKey as sk } from "./std.js";

export function lines(string: string) {
  return string.split(/\r\n|\n|\r/);
}

// return all lines with the given prefix, with the prefix removed.
// the output stops at the first empty or unprefixed line.
function extractPrefixedBlock(string: string, prefix: string) {
  const result = [];
  for (const line of lines(string)) {
    if (line !== "" && (prefix === "" || line.startsWith(prefix))) {
      result.push(line.replace(prefix, ""));
    } else {
      break;
    }
  }
  return result.join("\n");
}

// extract what might possibly be a #popclip YAML header from the given string
function candidateYaml(string: string) {
  // get the line starting with with #popclip and all subsequent content
  const components = string.match(/([^\n]*)# ?popclip.+$/is);
  if (components?.length !== 2) {
    return null;
  }

  // then extract the candidate lines
  const candidateYaml = extractPrefixedBlock(components[0], components[1]);

  // a snippet always contains something like `name:` or `name":`
  if (!/name\"\s*:|name:\s+/is.test(candidateYaml)) {
    return null;
  }

  // allow no no nbsp in yaml; parser doesn't like it
  return candidateYaml.replace(/\u00A0/g, " ").trim();
}

export enum EmbedType {
  Unknown = "unknown",
  Yaml = "yaml",
  ShellScript = "shell script",
  ExecutableShellScript = "executable shell script",
  AppleScript = "applescript",
  JavaScript = "javascript",
  TypeScript = "typescript",
  JavaScriptModule = "javascript module",
  TypeScriptModule = "typescript module",
}

function embedTypeFromText(text: string, yaml: string, config: Config) {
  let result: EmbedType = EmbedType.Unknown;

  let { module, language, interpreter } = config;
  if (typeof module === "string") {
    throw new Error("In a snippet, 'module' must be a boolean");
  }
  module = typeof module === "boolean" ? module : false;
  language = typeof language === "string" ? sk(language) : "";
  interpreter = typeof interpreter === "string" ? interpreter : "";
  if (module && !language) {
    throw new Error("A 'language' is needed with 'module'");
  }

  const hasAdditionalContent =
    lines(text.trim()).length > lines(yaml.trim()).length;
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
}

// look for tabs that seem to be outside braces;
// this is just for a helpful message, false negatives acceptable.
function hasTabsInBlock(yamlSource: string) {
  for (const line of lines(yamlSource)) {
    const parts = line.split("{");
    if (parts[0].includes("\t")) return true;
    if (parts.length > 1) break;
  }
  return false;
}

function forceString(val: unknown) {
  return typeof val === "string" ? val : "";
}

export function configFromText(text: string, externalSuffix: string = "") {
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

function suffixForEmbedType(embedType: EmbedType) {
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
}

function isExecutableForEmbedType(embedType: EmbedType) {
  switch (embedType) {
    case EmbedType.ExecutableShellScript:
      return true;
    default:
      return false;
  }
}

function selfReferenceFieldNameForEmbedType(embedType: EmbedType) {
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
}

export function loadSnippet(text: string, fileName: string) {
  try {
    const { config, embedType } = configFromText(text) ?? {
      config: {} as Config,
      embedType: EmbedType.Unknown,
    };
    // fix up the config to refer to itself if needed
    const fieldName = selfReferenceFieldNameForEmbedType(embedType);
    if (fieldName) {
      config[fieldName] = fileName;
    }
    return config;
  } catch (error) {
    const msg =
      error instanceof Error && error.message
        ? error.message
        : "Invalid snippet";
    throw new Error(msg);
  }
}
