import * as v from "valibot";
import { IconModifiersSchema } from "./icon";
import { formatValiIssues } from "./valibotIssues";

// from: https://github.com/fabian-hiller/valibot/issues/1034#issuecomment-3014696893
function required<TSchema extends v.GenericSchema<unknown>>(
  schema: TSchema,
  message?: v.ErrorMessage<v.InferIssue<TSchema>>,
) {
  const outputSchema = v.pipe(
    v.optional(schema, () => undefined),
    v.nonOptional(schema, message),
    schema,
  );
  return outputSchema;
}

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
    en: required(SaneStringSchema, "An 'en' string is required"),
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
  name: required(SaneStringSchema, "App name is required"),
  link: required(SaneStringSchema, "App link is required"),
  "check installed": v.optional(v.boolean()),
  "bundle identifier": v.optional(SaneStringSchema),
  "bundle identifiers": v.optional(v.array(SaneStringSchema)),
});

const OptionSchema = v.object({
  identifier: required(IdentifierSchema, "Option identifier is required"),
  type: required(SaneStringSchema, "Option type is required"),
  label: v.optional(LocalizableStringSchema),
  description: v.optional(LocalizableStringSchema),
  values: v.optional(v.array(SaneStringAllowingEmptySchema)),
  "value labels": v.optional(v.array(LocalizableStringSchema)),
  "default value": v.optional(
    v.union([SaneStringAllowingEmptySchema, v.boolean()]),
  ),
  hidden: v.optional(v.boolean()),
  inset: v.optional(v.boolean()),
  multiline: v.optional(v.boolean()),
  "allow other": v.optional(v.boolean()),
  "allow none": v.optional(v.boolean()),
  "migrate from": v.optional(IdentifierSchema),
  // Secret options only: which keychain the item goes in — the synchronizable
  // keychain ("sync", default, shared via iCloud Keychain) or the local
  // keychain ("local", this Mac only).
  keychain: v.optional(v.picklist(["sync", "local"])),
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
      modifiers: required(
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

/* The accepted values mirror what the app itself acts on (PopActionFlags.m).
 `httpurl`, `httpurls` and `html` are undocumented legacy synonyms of `url`,
 `urls` and `text`; they are accepted here because the app accepts them.
 A requirement may be negated with a leading `!`, and the dynamic form
 `option-<identifier>=<value>` matches against option values. */
const REQUIREMENT_KEYWORDS = [
  "text",
  "copy",
  "cut",
  "paste",
  "formatting",
  "url",
  "isurl",
  "httpurl",
  "urls",
  "httpurls",
  "email",
  "emails",
  "path",
  "html",
];
const RequirementSchema = v.pipe(
  SaneStringSchema,
  v.check((value) => {
    const bare = value.startsWith("!") ? value.slice(1) : value;
    return (
      REQUIREMENT_KEYWORDS.includes(bare) || /^option-[^=]+=/.test(bare)
    );
  }, "Invalid requirement (a keyword, !keyword, or option-<identifier>=<value>)"),
);

const BEFORE_STEPS = ["copy", "cut", "paste", "paste-plain"] as const;
const AFTER_STEPS = [
  ...BEFORE_STEPS,
  "copy-result",
  "paste-result",
  "show-result",
  "preview-result",
  "show-status",
  "copy-selection",
  "popclip-appear",
] as const;

const ActionFlagsSchema = v.object({
  app: v.optional(AppSchema),
  apps: v.optional(v.array(AppSchema)),
  "capture html": v.optional(v.boolean()),
  "capture rtf": v.optional(v.boolean()),
  "stay visible": v.optional(v.boolean()),
  "restore pasteboard": v.optional(v.boolean()),
  requirements: v.optional(v.array(RequirementSchema)),
  "required apps": v.optional(v.array(SaneStringSchema)),
  "excluded apps": v.optional(v.array(SaneStringSchema)),
  regex: v.optional(LongStringSchema),
  before: v.optional(v.picklist(BEFORE_STEPS)),
  after: v.optional(v.picklist(AFTER_STEPS)),
  permissions: v.optional(v.array(SaneStringSchema)),
  "show as": v.optional(v.picklist(["icon", "text"])),
  color: v.optional(SaneStringSchema),
  /* Menu presentation hints. Preferences, not commands: PopClip may ignore either, and where
   several ask, the first in popup order wins. "wants primary display" asks to be the button
   centred above the pointer; "wants initial display" asks that an action's submenu already be
   open when the popup appears. */
  "wants primary display": v.optional(v.boolean()),
  "wants initial display": v.optional(v.boolean()),
});

const ServiceActionSchema = v.object({
  "service name": v.optional(SaneStringSchema),
});

const ShortcutActionSchema = v.object({
  "shortcut name": v.optional(SaneStringSchema),
});

const UrlActionSchema = v.object({
  url: v.optional(SaneStringSchema),
  "clean query": v.optional(v.boolean()),
  "spaces as plus": v.optional(v.boolean()),
});

const KeyComboActionSchema = v.object({
  "key combo": v.optional(KeyComboSchema),
  "key combos": v.optional(v.array(KeyComboSchema)),
  // Where PopClip posts the key events: to the session event tap ("session", the default), to the
  // process of the app the action is acting on ("app"), or to the HID event tap ("hid").
  "key combo target": v.optional(v.picklist(["session", "app", "hid"])),
});

const AppleScriptActionSchema = v.object({
  applescript: v.optional(LongStringSchema),
  "applescript file": v.optional(SaneStringSchema),
  "applescript call": v.optional(
    v.object({
      file: v.optional(SaneStringSchema),
      handler: required(SaneStringSchema, "Handler name is required"),
      parameters: v.optional(v.array(SaneStringSchema)),
    }),
  ),
});

const ShellScriptActionSchema = v.object({
  "shell script": v.optional(LongStringSchema),
  "shell script file": v.optional(SaneStringSchema),
  interpreter: v.optional(SaneStringSchema),
  stdin: v.optional(SaneStringSchema),
  /* How the run is executed: through the user's shell as a login shell (-lc) or non-login
   shell (-c), or with no shell at all ("none": the interpreter or shebang file is executed
   directly). Unspecified means login, or nonlogin when the user has set the legacy
   NoLoginShell defaults key. */
  "shell mode": v.optional(v.picklist(["login", "nonlogin", "none"])),
});

const JavaScriptActionSchema = v.object({
  javascript: v.optional(LongStringSchema),
  "javascript file": v.optional(SaneStringSchema),
});

const MenuNodeSchema = v.object({
  submenu: v.optional(
    v.array(v.lazy((): v.GenericSchema<unknown> => ActionSchema)),
  ),
  separator: v.optional(v.boolean()),
});

export const ActionSchema = v.object({
  ...ActionCoreSchema.entries,
  ...ActionFlagsSchema.entries,
  ...MenuNodeSchema.entries,
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
  name: required(LocalizableStringSchema, "A name is required"),
  icon: v.optional(IconSchema),
  identifier: v.optional(IdentifierSchema),
  "popclip version": v.optional(VersionNumberSchema),
  "macos version": v.optional(VersionStringSchema),
  entitlements: v.optional(v.array(SaneStringSchema)),
  "offers multiple instances": v.optional(v.boolean()),
  "auth service label": v.optional(LocalizableStringSchema),
  // Which keychain the sign-in secret (authsecret) goes in — as the per-option
  // `keychain` key, for the one secret that has no declared option.
  "auth keychain": v.optional(v.picklist(["sync", "local"])),
  /* Extensions Directory submission requirement: an extension with a static
   shell script action must explain why a shell script is needed. */
  "shell script rationale": v.optional(LongStringSchema),

  // module (false is the snippet module-inference opt-out)
  module: v.optional(v.union([SaneStringSchema, v.boolean()])),
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
