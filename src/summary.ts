import * as v from "valibot";
import { IconComponentsSchema, standardizeIcon } from "./icon";
import {
  type AppSchema,
  type ExtensionSchema,
  LocalizableStringSchema,
  SaneStringSchema,
  VersionNumberSchema,
} from "./validate";

const SENTINEL_KEYS = {
  service: ["service name"],
  url: ["url"],
  keypress: ["key combo", "key combos"],
  applescript: ["applescript", "applescript file", "applescript call"],
  shellscript: ["shell script", "shell script file"],
  javascript: ["javascript", "javascript file"],
  shortcut: ["shortcut name"],
  none: [],
};
const ActionTypeSchema = v.picklist(Object.keys(SENTINEL_KEYS));

const ExtensionsSummarySchema = v.object({
  name: LocalizableStringSchema,
  identifier: v.optional(SaneStringSchema),
  description: v.optional(LocalizableStringSchema),
  keywords: v.optional(SaneStringSchema),
  icon: v.optional(IconComponentsSchema),
  actionTypes: v.array(ActionTypeSchema),
  entitlements: v.optional(v.array(SaneStringSchema)),
  apps: v.optional(
    v.array(v.object({ name: SaneStringSchema, link: SaneStringSchema })),
  ),
  macosVersion: v.optional(SaneStringSchema),
  popclipVersion: v.optional(VersionNumberSchema),
});

function normalizeLocalizedString(
  ls?: v.InferOutput<typeof LocalizableStringSchema>,
) {
  return typeof ls === "object" && Object.entries(ls).length === 1 ? ls.en : ls;
}

export function extractSummary(config: v.InferOutput<typeof ExtensionSchema>) {
  // build actions list
  const actions = config.actions
    ? config.actions
    : config.action
      ? [config.action]
      : [];

  // extract icon
  const icon = (() => {
    let parsedIcon;
    for (const obj of [config, ...actions]) {
      if (obj.icon) {
        parsedIcon = standardizeIcon(obj.icon, obj);
        break;
      }
    }
    if (parsedIcon?.ok) {
      return parsedIcon.result;
    }
    return undefined;
  })();

  // extract action types
  const actionTypesSet = new Set<string>();
  if (config.module) {
    actionTypesSet.add("javascript");
  } else {
    for (const action of [...actions, config]) {
      for (const [type, keys] of Object.entries(SENTINEL_KEYS)) {
        if (keys.some((key) => Object.hasOwn(action, key))) {
          actionTypesSet.add(type);
          break;
        }
      }
    }
  }
  if (actionTypesSet.size === 0 && actions.length > 0) {
    actionTypesSet.add("none"); // e.g. word & character count
  }
  const actionTypes = Array.from(actionTypesSet);

  // extract app links
  const apps: v.InferOutput<typeof AppSchema>[] = [];
  for (const obj of [config, ...actions]) {
    if (obj.apps) {
      for (const app of obj.apps) {
        apps.push({ name: app.name, link: app.link });
      }
    } else if (obj.app) {
      apps.push({ name: obj.app.name, link: obj.app.link });
    }
  }

  return v.parse(ExtensionsSummarySchema, {
    name: normalizeLocalizedString(config.name),
    actionTypes,
    identifier: config.identifier,
    description: normalizeLocalizedString(config.description),
    keywords: config.keywords,
    icon: icon,
    entitlements: config.entitlements?.length ? config.entitlements : undefined,
    apps: apps.length ? apps : undefined,
    macosVersion: config["macos version"],
    popclipVersion: config["popclip version"],
  });
}
