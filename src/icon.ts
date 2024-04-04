import { kebabCase } from "case-anything";
import emojiRegex from "emoji-regex";
import * as v from "valibot";
import { Config } from "./config.js";
import { log } from "./log.js";
import { standardizeConfig, standardizeKey } from "./std.js";

log("ereg", JSON.stringify(emojiRegex, null, 2));

// Emji detector utilty
const r = new RegExp("^(" + emojiRegex().source + ")$");
export function isSingleEmoji(string: string) {
  return r.test(string);
}

const NumberAsString = v.union([
  v.number(),
  v.transform(v.string(), (x) => Number(x)),
]);

const BooleanAsString = v.union([
  v.boolean(),
  v.transform(v.string(), (x) => x === "" || x === "1"),
]);

// these are in reverse order of precedence
const SHAPE_NAMES = ["search", "circle", "square"];

export const IconParamsSchema = v.object({
  "preserve color": v.optional(BooleanAsString, undefined),
  "preserve aspect": v.optional(BooleanAsString, undefined),
  shape: v.optional(v.picklist(SHAPE_NAMES), undefined),
  filled: v.optional(BooleanAsString, false),
  strike: v.optional(BooleanAsString, false),
  monospaced: v.optional(BooleanAsString, false),
  "flip x": v.optional(BooleanAsString, false),
  "flip y": v.optional(BooleanAsString, false),
  "move x": v.optional(NumberAsString, 0),
  "move y": v.optional(NumberAsString, 0),
  scale: v.optional(NumberAsString, 100),
  rotate: v.optional(NumberAsString, 0),
});

// default modifier values
const defaultModifierValues = new Map(
  Object.entries(v.getDefaults(IconParamsSchema) as {}),
);

function renderModifier(key: string, value: unknown) {
  key = kebabCase(key);
  if (key === "shape" && typeof value === "string") {
    return SHAPE_NAMES.includes(value) ? value : "";
  }
  if (typeof value === "boolean") return value ? key : `${key}=0`;
  if (typeof value === "number") return `${key}=${value.toString()}`;
  if (typeof value === "string") return `${key}=${value}`;
  return "";
}

function descriptorStringFromComponents({
  prefix,
  payload,
  modifiers,
}: { prefix: string; payload: string; modifiers: Config }) {
  const modifierString = Object.entries(modifiers)
    .map(([key, value]) => renderModifier(key, value))
    .filter((x) => x.length > 0)
    .join(" ");
  return `${modifierString} ${prefix}:${payload}`.trim();
}

export function standardizeIcon(specifier: string, extraParams: unknown) {
  const parsed = parseDescriptorString(specifier);
  if (!parsed.ok) {
    return parsed;
  }
  // swap shape= for shape name
  for (const shape of SHAPE_NAMES) {
    if (parsed.modifiers?.[shape]) {
      parsed.modifiers.shape = shape;
      delete parsed.modifiers[shape];
    }
  }

  // filter modifiers that are the same as the default
  const merged: Config = v.parse(IconParamsSchema, {
    ...parsed.modifiers,
    ...standardizeConfig(extraParams),
  });
  for (const [key, value] of Object.entries(merged)) {
    if (value === defaultModifierValues.get(key)) {
      delete merged[key];
    }
  }
  parsed.modifiers = merged;

  return {
    specifier: descriptorStringFromComponents(parsed),
    ...parsed,
  };
}

function parseDescriptorString(string: string) {
  string = string.trim();
  {
    // old extensions shim (Uppercase, Lowercase, Sentence Case, Capitalize)
    const components = string.match(/^(?:text:)?\[\[(.{1,3})\]\]$/);
    if (components) string = `square filled ${components[1]}`;
  }
  {
    // text:... old format shim
    const components = string.match(/^text:((?:[a-z]{2,10} )+)(\S{1,3}|\S \S)/);
    if (components) string = `${components[1]}text:${components[2]}`;
  }
  {
    // .svg or .png paths
    const components = string.match(/^[^:]+\.(svg|png)$/i);
    if (components) string = `file:${components[0]}`;
  }

  // special case of just an emoji
  if (isSingleEmoji(string)) {
    log("single emoji detected");
    return {
      ok: true as const,
      prefix: "text",
      payload: string,
      modifiers: {},
    };
  }

  // extract modifiers and the specifier
  const components = string.match(
    /^((?:[0-9a-z_=+-]+ +)*)(\S{1,3}|\S \S|[a-z]+:.*)$/i,
  );
  if (!components) {
    return {
      ok: false as const,
      error: `invalid icon descriptor: '${string}'`,
    };
  }

  // get modifiers string
  const modifiers = parseModifierString(components[1].trim());

  // get specifier, add text: prefix if needed
  let specifier = components[2];
  if (specifier.length <= 3) {
    specifier = `text:${specifier}`;
  }

  // parse the specifier
  const match = specifier.match(/^([a-z_]+):(.*)$/i);
  if (!match) {
    return {
      ok: false as const,
      error: `invalid icon specifier: '${specifier}'`,
    };
  }
  const prefix = match[1];
  const payload = match[2];

  // success!
  return { ok: true as const, prefix, payload, modifiers };
}

function parseModifierString(modifiers: string) {
  const result: Config = {};
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
