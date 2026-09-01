import type { Config } from "./config.js";
import { log } from "./log.js";
import { parseYamlObject } from "./parsers.js";
import { sniffModule } from "./sniff.js";
import { standardizeKey as sk, standardizeConfig } from "./std.js";

export function lines(string: string) {
  return string.split(/\r\n|\n|\r/);
}

// return all lines with the given prefix, with the prefix removed.
// when there is no prefix, treat the snippet as a single YAML block.
function extractPrefixedBlock(string: string, prefix: string) {
  if (prefix === "") {
    return string;
  }
  const result: string[] = [];
  for (const line of lines(string)) {
    if (line.startsWith(prefix)) {
      result.push(line.slice(prefix.length));
    } else {
      break;
    }
  }
  return result.join("\n");
}

// extract what might possibly be a #popclip YAML header from the given string,
// together with the header's line prefix (e.g. "// ", "# ", "" for plain YAML)
function candidateYaml(string: string) {
  // locate the first #popclip marker, requiring at least one character after it.
  // search for the bare marker and slice out the line: matching the line prefix
  // with a regex (/([^\n]*)# ?popclip.+$/is) backtracks quadratically, taking
  // tens of seconds on large single-line files with no marker.
  const found = string.match(/# ?popclip(?=[\s\S])/i);
  if (!found || found.index === undefined) {
    return null;
  }

  // the candidate block starts at the marker's line; text on that line before
  // the marker (e.g. "// ") is the prefix
  const lineStart = string.lastIndexOf("\n", found.index) + 1;
  const prefix = string.slice(lineStart, found.index);

  // then extract the candidate lines
  const candidateYaml = extractPrefixedBlock(string.slice(lineStart), prefix);

  // a snippet always contains something like `name:` or `name":`
  if (!/name"\s*:|name:\s+/is.test(candidateYaml)) {
    return null;
  }

  // allow no no nbsp in yaml; parser doesn't like it
  return { yaml: candidateYaml.replace(/\u00A0/g, " ").trim(), prefix };
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

// a real file's suffix IS its language — .js files are never transpiled, so
// the classification must say what the loader will actually do with the file
function languageForSuffix(suffix: string) {
  switch (suffix.toLowerCase()) {
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "applescript":
      return "applescript";
    default:
      return "";
  }
}

function embedTypeFromText(
  text: string,
  yaml: string,
  prefix: string,
  config: Config,
  externalLanguage: string,
) {
  let result: EmbedType = EmbedType.Unknown;

  let { module, language, interpreter } = config;
  if (typeof module === "string") {
    throw new Error("In a snippet, 'module' must be a boolean");
  }
  language = typeof language === "string" ? sk(language) : "";
  interpreter = typeof interpreter === "string" ? interpreter : "";

  // for a real file, the suffix determines the language (the `language` key
  // is for nameless snippet text only)
  language = externalLanguage || language;

  const hasAdditionalContent =
    lines(text.trim()).length > lines(yaml.trim()).length;

  // a code body under a //-comment header, with nothing else claiming it,
  // is TypeScript (which is also how plain JavaScript loads fine, since the
  // transpiler is transpile-only). precedence: language > interpreter > #!
  if (
    hasAdditionalContent &&
    !language &&
    !interpreter &&
    !text.startsWith("#!") &&
    prefix.trimStart().startsWith("//")
  ) {
    language = "typescript";
  }

  // absent an explicit 'module' boolean, module-ness of a JS-family body is
  // inferred from its syntax
  const isJsFamily = language === "javascript" || language === "typescript";
  if (typeof module !== "boolean") {
    module = hasAdditionalContent && isJsFamily && sniffModule(text);
  }
  if (module && !language) {
    throw new Error("A 'language' is needed with 'module'");
  }

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

export function configFromText(text: string, externalSuffix = "") {
  const candidate = candidateYaml(text);
  if (candidate === null) {
    return null;
  }
  const { yaml, prefix } = candidate;
  if (hasTabsInBlock(yaml)) {
    throw new Error("Don't use tabs in YAML");
  }
  const config = standardizeConfig(parseYamlObject(yaml));
  const embedType = embedTypeFromText(
    text,
    yaml,
    prefix,
    config,
    languageForSuffix(forceString(externalSuffix)),
  );
  let suffix = forceString(suffixForEmbedType(embedType));
  suffix ||= forceString(externalSuffix);
  suffix ||= forceString(config.suffix);
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
    default:
      return null;
  }
}

export function loadSnippet(text: string, fileName: string) {
  try {
    // the snippet lives in a real file, whose suffix determines the language
    const dot = fileName.lastIndexOf(".");
    const suffix = dot > 0 ? fileName.slice(dot + 1) : "";
    const { config, embedType } = configFromText(text, suffix) ?? {
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
