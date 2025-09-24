export type { Config } from "./src/config.js";
export {
  descriptorStringFromComponents,
  isSingleEmoji,
  standardizeIcon,
} from "./src/icon.js";
export { loadStaticConfig } from "./src/loader.js";
export { configFromText, type EmbedType } from "./src/snippet.js";
export { standardizeConfig, standardizeKey } from "./src/std.js";
export { extractSummary } from "./src/summary.js";
export { validateStaticConfig } from "./src/validate.js";
