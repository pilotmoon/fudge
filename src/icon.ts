import { kebabCase } from "case-anything";
import emojiRegex from "emoji-regex";
import * as v from "valibot";
import type { Config } from "./config.js";
import { log } from "./log.js";
import { standardizeConfig, standardizeKey } from "./std.js";
import { formatValiIssues } from "./valibotIssues.js";

// Emoji detector utilty
const r = new RegExp("^(" + emojiRegex().source + ")$");
export function isSingleEmoji(string: string) {
  return r.test(string);
}

const IntegerFromString = v.union([
  v.pipe(v.number(), v.safeInteger()),
  v.pipe(
    v.string(),
    v.transform((x) => Number(x)),
    v.safeInteger(),
  ),
]);

const BooleanFromString = v.union([
  v.boolean(),
  v.pipe(
    v.string(),
    v.transform((x) => x === "" || x === "1"),
  ),
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
  "preserve color": v.optional(BooleanFromString),
  "preserve aspect": v.optional(BooleanFromString),
  shape: v.optional(v.picklist(SHAPE_NAMES)),
  filled: v.optional(BooleanFromString),
  strike: v.optional(BooleanFromString),
  monospaced: v.optional(BooleanFromString),
  "flip x": v.optional(BooleanFromString),
  "flip y": v.optional(BooleanFromString),
  "move x": v.optional(IntegerFromString),
  "move y": v.optional(IntegerFromString),
  scale: v.optional(IntegerFromString),
  rotate: v.optional(IntegerFromString),
});

// default modifier values
export const defaultModifierValues = new Map(
  Object.entries(ICON_PARAM_DEFAULTS),
);

export const IconComponentsSchema = v.object({
  prefix: v.string(),
  payload: v.string(),
  modifiers: v.looseObject({}),
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
  components: v.InferOutput<typeof IconComponentsSchema>,
) {
  const { prefix, payload, modifiers } = components;
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
    if (parsed.result.modifiers?.[shape]) {
      parsed.result.modifiers.shape = shape;
      delete parsed.result.modifiers[shape];
    }
  }

  // validate modifiers
  const validated = v.safeParse(IconModifiersSchema, {
    ...parsed.result.modifiers,
    ...standardizeConfig(extraParams),
  });
  if (!validated.success) {
    return {
      ok: false as const,
      error: `invalid modifiers: ${formatValiIssues(validated.issues)}`,
    };
  }

  // remove default values
  for (const [key, value] of Object.entries(validated.output)) {
    if (value === defaultModifierValues.get(key)) {
      delete (validated.output as any)[key];
    }
  }

  parsed.result.modifiers = validated.output;
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
    /^((?:[0-9a-z_=+-]+ +)*)(\S{1,3}|\S \S|[a-z]+:.*)$/is,
  );
  if (!components) {
    return {
      ok: false as const,
      error: `invalid icon string: '${string}'`,
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
  const match = specifier.match(/^([a-z_]+):(.*)$/is);
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
