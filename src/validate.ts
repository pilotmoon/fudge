import * as v from "valibot";
import { IconModifiersSchema } from "./icon";
import { formatValiIssues } from "./valibotIssues";

/***********************************************************
  Schemas
***********************************************************/
export const SaneStringSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(500),
);
const SaneStringAllowingEmptySchema = v.pipe(v.string(), v.maxLength(500));
const LongStringSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(10000));

const StringTableSchema = v.intersect([
  v.record(SaneStringSchema, SaneStringSchema),
  v.object({
    en: v.nonOptional(SaneStringSchema, "An 'en' string is required"),
  }),
]);

export const LocalizableStringSchema = v.union([
  SaneStringSchema,
  StringTableSchema,
]);

export const IdentifierSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(100),
  v.regex(
    /^[a-z0-9]+([._-][a-z0-9]+)*$/i,
    "Invalid identifier (allowed: [a-zA-Z0-9]+, separated by [._-])",
  ),
);

export const VersionNumberSchema = v.pipe(
  v.number("Must be a number"),
  v.safeInteger("Must be an integer"),
  v.minValue(1),
);

const VersionStringSchema = v.pipe(
  v.string("Must be a string"),
  v.regex(/^[0-9]+(\.[0-9]+)(\.[0-9]+)?$/, "Bad format"),
);

const IconSchema = v.union([LongStringSchema, v.null_(), v.literal(false)]);

export const AppSchema = v.object({
  name: v.nonOptional(SaneStringSchema, "App name is required"),
  link: v.nonOptional(SaneStringSchema, "App link is required"),
  "check installed": v.optional(v.boolean()),
  "bundle identifier": v.optional(SaneStringSchema),
  "bundle identifiers": v.optional(v.array(SaneStringSchema)),
});

const OptionSchema = v.object({
  identifier: v.nonOptional(IdentifierSchema, "Option identifier is required"),
  type: v.nonOptional(SaneStringSchema, "Option type is required"),
  label: v.optional(LocalizableStringSchema),
  description: v.optional(LocalizableStringSchema),
  values: v.optional(v.array(SaneStringAllowingEmptySchema)),
  "value labels": v.optional(v.array(LocalizableStringSchema)),
  "default value": v.optional(
    v.union([SaneStringAllowingEmptySchema, v.boolean()]),
  ),
  hidden: v.optional(v.boolean()),
  inset: v.optional(v.boolean()),
  icon: v.optional(IconSchema),
  ...IconModifiersSchema.entries,
});

const KeyCodeSchema = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(0),
  v.maxValue(127),
);

const KeyComboSchema = v.union([
  KeyCodeSchema,
  SaneStringSchema,
  v.pipe(
    v.object({
      "key code": v.optional(KeyCodeSchema),
      "key char": v.optional(
        v.pipe(v.string(), v.minLength(1), v.maxLength(1)),
      ),
      modifiers: v.nonOptional(
        v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
        "'modifiers' is required",
      ),
    }),
    v.check((obj) => {
      const hasKeyCode = obj["key code"] !== undefined;
      const hasKeyChar = obj["key char"] !== undefined;
      return (hasKeyCode || hasKeyChar) && !(hasKeyCode && hasKeyChar);
    }, "One of 'key code' or 'key char' is required"),
  ),
]);

const ActionCoreSchema = v.object({
  title: v.optional(LocalizableStringSchema),
  icon: v.optional(IconSchema),
  identifier: v.optional(IdentifierSchema),
});

const ActionFlagsSchema = v.object({
  app: v.optional(AppSchema),
  apps: v.optional(v.array(AppSchema)),
  "capture html": v.optional(v.boolean()),
  "capture rtf": v.optional(v.boolean()),
  "stay visible": v.optional(v.boolean()),
  "restore pasteboard": v.optional(v.boolean()),
  requirements: v.optional(v.array(SaneStringSchema)),
  "required apps": v.optional(v.array(SaneStringSchema)),
  "excluded apps": v.optional(v.array(SaneStringSchema)),
  regex: v.optional(LongStringSchema),
  before: v.optional(SaneStringSchema),
  after: v.optional(SaneStringSchema),
  permissions: v.optional(v.array(SaneStringSchema)),
});

const ServiceActionSchema = v.object({
  "service name": v.optional(SaneStringSchema),
});

const ShortcutActionSchema = v.object({
  "shortcut name": v.optional(SaneStringSchema),
});

const UrlActionSchema = v.object({
  url: v.optional(SaneStringSchema),
  "alternate url": v.optional(SaneStringSchema),
  "clean query": v.optional(v.boolean()),
});

const KeyComboActionSchema = v.object({
  "key combo": v.optional(KeyComboSchema),
  "key combos": v.optional(v.array(KeyComboSchema)),
});

const AppleScriptActionSchema = v.object({
  applescript: v.optional(LongStringSchema),
  "applescript file": v.optional(SaneStringSchema),
  "applescript call": v.optional(
    v.object({
      file: v.optional(SaneStringSchema),
      handler: v.nonOptional(SaneStringSchema, "Handler name is required"),
      parameters: v.optional(v.array(SaneStringSchema)),
    }),
  ),
});

const ShellScriptActionSchema = v.object({
  "shell script": v.optional(LongStringSchema),
  "shell script file": v.optional(SaneStringSchema),
  interpreter: v.optional(SaneStringSchema),
  stdin: v.optional(SaneStringSchema),
});

const JavaScriptActionSchema = v.object({
  javascript: v.optional(LongStringSchema),
  "javascript file": v.optional(SaneStringSchema),
});

export const ActionSchema = v.object({
  ...ActionCoreSchema.entries,
  ...ActionFlagsSchema.entries,
  ...IconModifiersSchema.entries,
  ...ServiceActionSchema.entries,
  ...ShortcutActionSchema.entries,
  ...UrlActionSchema.entries,
  ...KeyComboActionSchema.entries,
  ...AppleScriptActionSchema.entries,
  ...ShellScriptActionSchema.entries,
  ...JavaScriptActionSchema.entries,
});

const ExtensionCoreSchema = v.object({
  name: v.nonOptional(LocalizableStringSchema, "A name is required"),
  icon: v.optional(IconSchema),
  identifier: v.optional(IdentifierSchema),
  "popclip version": v.optional(VersionNumberSchema),
  "macos version": v.optional(VersionStringSchema),
  entitlements: v.optional(v.array(SaneStringSchema)),

  // module
  module: v.optional(v.union([SaneStringSchema, v.literal(true)])),
  language: v.optional(SaneStringSchema),

  // actions
  action: v.optional(ActionSchema),
  actions: v.optional(v.array(ActionSchema)),

  // options
  options: v.optional(v.array(OptionSchema)),
  "options title": v.optional(LocalizableStringSchema),
  "options script file": v.optional(SaneStringSchema),
});

const MetadataSchema = v.object({
  description: v.optional(LocalizableStringSchema),
  keywords: v.optional(SaneStringSchema),
});

export const ExtensionSchema = v.object({
  ...ExtensionCoreSchema.entries,
  ...ActionSchema.entries,
  ...MetadataSchema.entries,
});

export function validateStaticConfig(config: unknown) {
  try {
    return v.parse(ExtensionSchema, config);
  } catch (error) {
    if (error instanceof v.ValiError) {
      throw new Error(formatValiIssues(error.issues));
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid base config: ${msg}`);
  }
}
