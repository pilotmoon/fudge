import {
  Issue,
  ValiError,
  array,
  safeInteger,
  intersect,
  maxLength,
  minLength,
  nonOptional,
  object,
  optional,
  parse,
  record,
  regex,
  string,
  transform,
  union,
  number,
  minValue,
  enum_,
  literal,
} from "valibot";
import { log, logw } from "./log";

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

const ExtensionCoreSchema = object({
  name: nonOptional(LocalizableStringSchema, "A name is required"),
  identifier: optional(IdentifierSchema),
  "popclip version": optional(VersionNumberSchema),
  "macos version": optional(VersionStringSchema),
  module: optional(ModuleSchema),
  entitlements: optional(EntitlementsSchema),
});

export function validateStaticConfig(config: unknown) {
  try {
    return parse(ExtensionCoreSchema, config);
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
