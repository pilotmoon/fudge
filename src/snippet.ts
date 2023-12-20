import { Config } from "./config.js";
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

enum EmbedType {
  Unknown = "unknown",
  Yaml = "yaml",
  ShellScript = "shell script",
  Executable = "executable shell script",
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
    throw new Error("In a header, 'module' must be a boolean");
  }
  module = typeof module === "boolean" ? module : false;
  language = typeof language === "string" ? sk(language) : "";
  interpreter = typeof interpreter === "string" ? sk(interpreter) : "";
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
      result = EmbedType.Executable;
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

export function configFromText(text: string) {
  const yaml = candidateYaml(text);
  if (yaml === null) {
    return null;
  }
  if (hasTabsInBlock(yaml)) {
    throw new Error("Don't use tabs in YAML");
  }
  const config = standardizeConfig(parseYamlObject(yaml));
  const embedType = embedTypeFromText(text, yaml, config);
  return { config, embedType };
}

export function loadSnippet(text: string, fileName: string) {
  try {
    const { config, embedType } = configFromText(text) ?? {
      config: {},
      embedType: EmbedType.Unknown,
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
      [EmbedType.Unknown]: null,
    }[embedType];
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
