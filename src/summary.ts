import {
  Output,
  array,
  object,
  optional,
  parse,
  picklist,
  record,
  unknown,
} from "valibot";
import {
  ExtensionSchema,
  ActionSchema,
  AppSchema,
  LocalizableStringSchema,
  SaneStringSchema,
  VersionNumberSchema,
} from "./validate";
import { standardizeIcon } from "./icon";

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
const ActionTypeSchema = picklist(Object.keys(SENTINEL_KEYS));

const ExtensionsSummarySchema = object({
  name: SaneStringSchema,
  identifier: optional(SaneStringSchema),
  description: optional(SaneStringSchema),
  keywords: optional(SaneStringSchema),
  icon: optional(
    object({
      prefix: SaneStringSchema,
      payload: SaneStringSchema,
      modifiers: record(unknown()),
    }),
  ),
  actionTypes: array(ActionTypeSchema),
  entitlements: optional(array(SaneStringSchema)),
  apps: optional(
    array(object({ name: SaneStringSchema, link: SaneStringSchema })),
  ),
  macosVersion: optional(SaneStringSchema),
  popclipVersion: optional(VersionNumberSchema),
});

function extractLocalizedString(ls?: Output<typeof LocalizableStringSchema>) {
  if (typeof ls === "string") {
    return ls;
  } else if (typeof ls?.en === "string") {
    return ls.en;
  }
}

export function extractSummary(config: Output<typeof ExtensionSchema>) {
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
        if (keys.some((key) => action.hasOwnProperty(key))) {
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
  const apps: Output<typeof AppSchema>[] = [];
  for (const obj of [config, ...actions]) {
    if (obj.apps) {
      for (const app of obj.apps) {
        apps.push({ name: app.name, link: app.link });
      }
    } else if (obj.app) {
      apps.push({ name: obj.app.name, link: obj.app.link });
    }
  }

  return parse(ExtensionsSummarySchema, {
    name: extractLocalizedString(config.name),
    actionTypes,
    identifier: config.identifier,
    description: extractLocalizedString(config.description),
    keywords: config.keywords,
    icon: icon,
    entitlements: config.entitlements?.length ? config.entitlements : undefined,
    apps: apps.length ? apps : undefined,
    macosVersion: config["macos version"],
    popclipVersion: config["popclip version"],
  });
}
