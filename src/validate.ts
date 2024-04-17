import {
  ValiError,
  array,
  boolean,
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
  number,
  object,
  optional,
  parse,
  record,
  regex,
  safeInteger,
  string,
  union,
  unknown,
} from "valibot";
import { IconModifiersSchema } from "./icon";
import { formatValiIssues } from "./valibotIssues";

/***********************************************************
  Schemas
***********************************************************/
const SaneStringSchema = string([minLength(1), maxLength(500)]);
const SaneStringAllowingEmptySchema = string([maxLength(500)]);
const LongStringSchema = string([minLength(1), maxLength(10000)]);

const StringTableSchema = intersect([
  record(SaneStringSchema, SaneStringSchema),
  object({
    en: nonOptional(SaneStringSchema, "An 'en' string is required"),
  }),
]);

const LocalizableStringSchema = union([SaneStringSchema, StringTableSchema]);

export const IdentifierSchema = string([
  minLength(1),
  maxLength(100),
  regex(
    /^[a-z0-9]+([._-][a-z0-9]+)*$/i,
    "Invalid identifier (allowed: [a-zA-Z0-9]+, separated by [._-])",
  ),
]);

const VersionNumberSchema = number("Must be a number", [
  safeInteger("Must be an integer"),
  minValue(1),
]);

const VersionStringSchema = string("Must be a string", [
  regex(/^[0-9]+(\.[0-9]+)(\.[0-9]+)?$/, `Bad format`),
]);

const IconSchema = union([LongStringSchema, null_(), literal(false)]);

const AppSchema = object({
  name: nonOptional(SaneStringSchema, "App name is required"),
  link: nonOptional(SaneStringSchema, "App link is required"),
  "check installed": optional(boolean()),
  "bundle identifier": optional(SaneStringSchema),
  "bundle identifiers": optional(array(SaneStringSchema)),
});

const OptionSchema = merge([
  object({
    identifier: nonOptional(IdentifierSchema, "Option identifier is required"),
    type: nonOptional(SaneStringSchema, "Option type is required"),
    label: optional(LocalizableStringSchema),
    description: optional(LocalizableStringSchema),
    values: optional(array(SaneStringAllowingEmptySchema)),
    "value labels": optional(array(LocalizableStringSchema)),
    "default value": optional(
      union([SaneStringAllowingEmptySchema, boolean()]),
    ),
    hidden: optional(boolean()),
    inset: optional(boolean()),
    icon: optional(IconSchema),
  }),
  IconModifiersSchema,
]);

const KeyCodeSchema = number([safeInteger(), minValue(0), maxValue(127)]);

const KeyComboSchema = union([
  KeyCodeSchema,
  SaneStringSchema,
  object(
    {
      "key code": optional(KeyCodeSchema),
      "key char": optional(string([minLength(1), maxLength(1)])),
      modifiers: nonOptional(
        number([safeInteger(), minValue(0)]),
        "'modifiers' is required",
      ),
    },
    [
      custom((obj) => {
        const hasKeyCode = obj["key code"] !== undefined;
        const hasKeyChar = obj["key char"] !== undefined;
        return (hasKeyCode || hasKeyChar) && !(hasKeyCode && hasKeyChar);
      }, "One of 'key code' or 'key char' is required"),
    ],
  ),
]);

const ActionCoreSchema = object({
  title: optional(LocalizableStringSchema),
  icon: optional(IconSchema),
  identifier: optional(IdentifierSchema),
});

const ActionFlagsSchema = object({
  app: optional(AppSchema),
  apps: optional(array(AppSchema)),
  "capture html": optional(boolean()),
  "capture rtf": optional(boolean()),
  "stay visible": optional(boolean()),
  "restore pasteboard": optional(boolean()),
  requirements: optional(array(SaneStringSchema)),
  "required apps": optional(array(SaneStringSchema)),
  "excluded apps": optional(array(SaneStringSchema)),
  regex: optional(LongStringSchema),
  before: optional(SaneStringSchema),
  after: optional(SaneStringSchema),
  permissions: optional(array(SaneStringSchema)),
});

const ServiceActionSchema = object({
  "service name": optional(SaneStringSchema),
});

const ShortcutActionSchema = object({
  "shortcut name": optional(SaneStringSchema),
});

const UrlActionSchema = object({
  url: optional(SaneStringSchema),
  "alternate url": optional(SaneStringSchema),
  "clean query": optional(boolean()),
});

const KeyComboActionSchema = object({
  "key combo": optional(KeyComboSchema),
  "key combos": optional(array(KeyComboSchema)),
});

const AppleScriptActionSchema = object({
  applescript: optional(LongStringSchema),
  "applescript file": optional(SaneStringSchema),
  "applescript call": optional(
    object({
      file: optional(SaneStringSchema),
      handler: nonOptional(SaneStringSchema, "Handler name is required"),
      parameters: optional(array(SaneStringSchema)),
    }),
  ),
});

const ShellScriptActionSchema = object({
  "shell script": optional(LongStringSchema),
  "shell script file": optional(SaneStringSchema),
  interpreter: optional(SaneStringSchema),
  stdin: optional(SaneStringSchema),
});

const JavaScriptActionSchema = object({
  javascript: optional(LongStringSchema),
  "javascript file": optional(SaneStringSchema),
});

const ActionSchema = merge([
  ActionCoreSchema,
  ActionFlagsSchema,
  IconModifiersSchema,
  ServiceActionSchema,
  ShortcutActionSchema,
  UrlActionSchema,
  KeyComboActionSchema,
  AppleScriptActionSchema,
  ShellScriptActionSchema,
  JavaScriptActionSchema,
]);

const ExtensionCoreSchema = object({
  name: nonOptional(LocalizableStringSchema, "A name is required"),
  icon: optional(IconSchema),
  identifier: optional(IdentifierSchema),
  "popclip version": optional(VersionNumberSchema),
  "macos version": optional(VersionStringSchema),
  entitlements: optional(array(SaneStringSchema)),

  // module
  module: optional(union([SaneStringSchema, literal(true)])),
  language: optional(SaneStringSchema),

  // actions
  action: optional(ActionSchema),
  actions: optional(array(ActionSchema)),

  // options
  options: optional(array(OptionSchema)),
  "options title": optional(LocalizableStringSchema),
  "options script file": optional(null_("Not supported")),
});

const ExtensionSchema = merge([ExtensionCoreSchema, ActionSchema]);

export function validateStaticConfig(config: unknown) {
  try {
    return parse(ExtensionSchema, config);
  } catch (error) {
    if (error instanceof ValiError) {
      throw new Error(formatValiIssues(error.issues));
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid base config: ${msg}`);
  }
}
