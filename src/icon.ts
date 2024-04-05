import { kebabCase } from "case-anything";
import emojiRegex from "emoji-regex";
import * as v from "valibot";
import { Config } from "./config.js";
import { log } from "./log.js";
import { standardizeConfig, standardizeKey } from "./std.js";

// Emoji detector utilty
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

const ICON_PARAM_DEFAULTS = {
  "preserve color": undefined,
  "preserve aspect": undefined,
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
};

export const IconModifiersSchema = v.object({
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

// default modifier values
export const defaultModifierValues = new Map(
  Object.entries(ICON_PARAM_DEFAULTS),
);

export const IconComponentsSchema = v.object({
  prefix: v.string(),
  payload: v.string(),
  modifiers: v.object({}, v.unknown()),
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

export function descriptorStringFromComponents(
  components: v.Output<typeof IconComponentsSchema>,
) {
  const { prefix, payload, modifiers } = components;
  const modifierString = Object.entries(modifiers)
    .map(([key, value]) => renderModifier(key, value))
    .filter((x) => x.length > 0)
    .join(" ");
  return `${modifierString} ${prefix}:${payload}`.trim();
}

export function standardizeIcon(specifier: string, extraParams: unknown) {
  log("standardizeIcon", specifier, extraParams);
  const parsed = parseDescriptorString(specifier);
  if (!parsed.ok) {
    return parsed;
  }
  // swap shape= for shape name
  for (const shape of SHAPE_NAMES) {
    if (parsed.result.modifiers?.[shape]) {
      parsed.result.modifiers.shape = shape;
      delete parsed.result.modifiers[shape];
    }
  }

  // filter modifiers that are the same as the default
  const merged: Config = v.parse(IconModifiersSchema, {
    ...parsed.result.modifiers,
    ...standardizeConfig(extraParams),
  });
  for (const [key, value] of Object.entries(merged)) {
    if (value === defaultModifierValues.get(key)) {
      delete merged[key];
    }
  }
  parsed.result.modifiers = merged;
  return parsed;
}

/*****************************************************************************/
// Internal parsing guts

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
      result: {
        prefix: "text",
        payload: string,
        modifiers: {},
      },
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
  return {
    ok: true as const,
    result: {
      prefix,
      payload,
      modifiers,
    },
  };
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
