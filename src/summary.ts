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
  const actions: Output<typeof ActionSchema>[] = [];
  if (config.actions) {
    actions.push(...config.actions);
  } else if (config.action) {
    actions.push(config.action);
  } else {
    actions.push(config);
  }

  // extract icon
  const icon = (() => {
    let parsedIcon;
    if (config.icon) {
      parsedIcon = standardizeIcon(config.icon, config);
    }
    for (const action of actions) {
      if (action.icon) {
        parsedIcon = standardizeIcon(action.icon, action);
      }
    }
    if (parsedIcon?.ok) {
      return parsedIcon.result;
    }
    return undefined;
  })();

  // extract action types
  const actionTypesSet = new Set<string>();
  for (const action of actions) {
    for (const [type, keys] of Object.entries(SENTINEL_KEYS)) {
      if (keys.some((key) => action.hasOwnProperty(key))) {
        actionTypesSet.add(type);
        break;
      }
    }
    actionTypesSet.add("none");
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
  });
}
