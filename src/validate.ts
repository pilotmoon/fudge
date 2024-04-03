import {
  Output,
  SchemaIssue,
  ValiError,
  array,
  enum_,
  intersect,
  literal,
  maxLength,
  merge,
  minLength,
  minValue,
  nonOptional,
  null_,
  number,
  object,
  optional,
  parse,
  picklist,
  record,
  regex,
  safeInteger,
  string,
  transform,
  union,
} from "valibot";

/***********************************************************
  Schemas
***********************************************************/
const SaneStringSchema = string([minLength(1), maxLength(500)]);

const StringTableSchema = intersect([
  record(SaneStringSchema, SaneStringSchema),
  object({
    en: nonOptional(SaneStringSchema, "An 'en' string is required"),
  }),
]);

const LocalizableStringSchema = transform(
  union([SaneStringSchema, StringTableSchema]),
  (value) => (typeof value === "string" ? { en: value } : value),
);

const IdentifierSchema = string([
  minLength(1),
  maxLength(100),
  regex(/^[a-z0-9]+([._-]?[a-z0-9]+)*$/i, "Invalid identifier"),
]);

const VersionNumberSchema = number("Must be a number", [
  safeInteger("Must be an integer"),
  minValue(1),
]);

const VersionStringSchema = string("Must be a string", [
  regex(/^[0-9]+(\.[0-9]+)(\.[0-9]+)?$/, `Bad format`),
]);

const ModuleSchema = union([SaneStringSchema, literal(true)]);

const EntitlementsSchema = array(SaneStringSchema);

const AppSchema = object({
  name: nonOptional(SaneStringSchema, "A name is required"),
  link: nonOptional(string(), "A link is required"),
});

const ActionSchema = object({
  title: optional(LocalizableStringSchema),
  icon: optional(union([string(), null_()])),
  app: optional(AppSchema),
  apps: optional(array(AppSchema)),
  "service name": optional(string()),
  url: optional(string()),
  "key combo": optional(union([string(), object({})])),
  "key combos": optional(array(string())),
  applescript: optional(string()),
  "applescript file": optional(string()),
  "applescript call": optional(object({})),
  "shell script": optional(string()),
  "shell script file": optional(string()),
  javascript: optional(string()),
  "javascript file": optional(string()),
  "shortcut name": optional(string()),
});

const ExtensionSchema = merge([
  object({
    name: nonOptional(LocalizableStringSchema, "A name is required"),
    identifier: optional(IdentifierSchema),
    "popclip version": optional(VersionNumberSchema),
    "macos version": optional(VersionStringSchema),
    module: optional(ModuleSchema),
    entitlements: optional(EntitlementsSchema),
    actions: optional(array(ActionSchema)),
    description: optional(LocalizableStringSchema),
  }),
  ActionSchema,
]);

// const ActionTypeSchema = picklist([
//   "service",
//   "url",
//   "key combo",
//   "applescript",
//   "shell script",
//   "javascript",
//   "shortcut",
//   "none",
// ] as const);

// function inferIcon(extension: Output<typeof ExtensionSchema>) {
//   if (extension.icon) {
//     return extension.icon;
//   } else if (extension.actions) {
//     for (const action of extension.actions) {
//       if (action.icon) {
//         return action.icon;
//       }
//     }
//   }
//   return undefined;
// }

// function classifyAction(
//   action: Output<typeof ActionSchema>,
// ): Output<typeof ActionTypeSchema> {
//   if (action["service name"]) {
//     return "service";
//   }
//   if (action.url) {
//     return "url";
//   }
//   if (action["key combo"] || action["key combos"]) {
//     return "key combo";
//   }
//   if (
//     action.applescript ||
//     action["applescript file"] ||
//     action["applescript call"]
//   ) {
//     return "applescript";
//   }
//   if (action["shell script"] || action["shell script file"]) {
//     return "shell script";
//   }
//   if (action.javascript || action["javascript file"]) {
//     return "javascript";
//   }
//   if (action["shortcut name"]) {
//     return "shortcut";
//   }
//   return "none";
// }

// function inferActionTypes(extension: Output<typeof ExtensionSchema>) {
//   const types = new Set<string>();
//   if (extension.module) {
//     types.add("javascript");
//   } else if (extension.actions) {
//     for (const action of extension.actions) {
//       types.add(classifyAction(action));
//     }
//   } else {
//     types.add(classifyAction(extension));
//   }
//   return parse(array(ActionTypeSchema), Array.from(types));
// }

export function validateStaticConfig(config: unknown) {
  try {
    const result = parse(ExtensionSchema, config);
    // result.icon = inferIcon(result);
    // result["action types"] = inferActionTypes(result);
    return result;
  } catch (error) {
    if (error instanceof ValiError) {
      throw new Error(formatValiError(error));
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid base config: ${msg}`);
  }
}

function formatValiError(error: ValiError) {
  const messages = [];
  for (const issue of error.issues) {
    const fmt = formatValiIssue(issue);
    if (fmt) {
      messages.push(`${fmt.dotPath}: ${fmt.message}`);
    }
  }
  return messages.join("\n"); // + `--- \n${JSON.stringify(error, undefined, 2)}`;
}

function formatValiIssue(issue: SchemaIssue): {
  dotPath: string;
  message: string;
} {
  const dotPath = issue.path?.map((item) => item.key).join(".") ?? "";
  if (Array.isArray(issue.issues) && issue.issues.length > 0) {
    const fmt = formatValiIssue(
      issue.issues?.find((item) => item?.path?.length ?? 0) ?? issue.issues[0],
    );
    fmt.dotPath = fmt.dotPath ? `${dotPath}.${fmt.dotPath}` : dotPath;
    return fmt;
  }
  const message = `${issue.message} (value: ${JSON.stringify(issue.input)})`;
  return { dotPath, message };
}
