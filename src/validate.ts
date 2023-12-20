import {
  Issue,
  Output,
  ValiError,
  array,
  flatten,
  intersect,
  maxLength,
  minLength,
  nonOptional,
  object,
  optional,
  parse,
  record,
  regex,
  safeParse,
  string,
  transform,
  union,
} from "valibot";
import { log, logw } from "./log";
import { standardizeKey } from "./std";

// The preferred localizations for the current process.
let preferredLocalizations: string[] = [];

/**
 * Set the preferred localizations for the current process.
 * @param pl - An array of preferred localizations, in order of preference.
 */
export function setPreferredLocalizations(pl?: string[]) {
  const { success, output } = safeParse(array(string()), pl);
  preferredLocalizations = success ? output.map(standardizeKey) : ["en"];
}

/***********************************************************
  Schemas
***********************************************************/
const SaneStringSchema = string([minLength(1), maxLength(80)]);

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

const ProcessedLocalizableStringSchema = transform(
  LocalizableStringSchema,
  (value) => {
    const canonical = value.en;
    const preferred =
      preferredLocalizations.map((key) => value[key]).find((v) => v) ??
      canonical;
    return { table: value, preferred, canonical };
  },
);

const IdentifierSchema = string([
  minLength(1),
  maxLength(100),
  regex(
    /^[0-9a-zA-Z-_.]*$/,
    "Use only A-Z, a-z, 0-9, hyphen (-), underscore (_), and period (.)",
  ),
]);

const ExtensionSchema = object({
  name: nonOptional(ProcessedLocalizableStringSchema, "A name is required"),
  identifier: optional(IdentifierSchema),
});

export function validateStaticConfig(config: unknown) {
  try {
    const base = parse(ExtensionSchema, config);
    return base;
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

function formatValiIssue(issue: Issue): { dotPath: string; message: string } {
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
