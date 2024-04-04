import { standardizeConfig, standardizeKey } from "./std.js";
import emojiRegex from "emoji-regex";
import { log } from "./log.js";
import { Config } from "./config.js";
import * as v from "valibot";
import { kebabCase } from "case-anything";

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

// default modifier values
const defaultModifierValues = new Map(
  Object.entries({
    "preserve aspect": undefined,
    "preserve color": undefined,
    shape: undefined,
    filled: false,
    strike: false,
    monospaced: false,
    "flip x": false,
    "flip y": false,
    "move x": 0,
    "move y": 0,
    scale: 100,
    rotate: 0,
  }),
);

const IconParamsSchema = v.object({
  "preserve color": v.optional(BooleanAsString),
  "preserve aspect": v.optional(BooleanAsString),
  shape: v.optional(v.picklist(SHAPE_NAMES)),
  filled: v.optional(BooleanAsString),
  strike: v.optional(BooleanAsString),
  monospaced: v.optional(BooleanAsString),
  "flip x": v.optional(BooleanAsString),
  "flip y": v.optional(BooleanAsString),
  "move x": v.optional(NumberAsString),
  "move y": v.optional(NumberAsString),
  scale: v.optional(NumberAsString),
  rotate: v.optional(NumberAsString),
});

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

export function standardizeIcon(specifier: string, extraParams: Config) {
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
  console.log("extraParams", extraParams);
  console.log("merged", merged);
  for (const [key, value] of Object.entries(merged)) {
    console.log(key, value, defaultModifierValues.get(key));
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
