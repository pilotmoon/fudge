import { setIdMaker } from "./src/validate.js";

export { loadStaticConfig } from "./src/loader.js";
export { validateStaticConfig } from "./src/validate.js";
export { configFromText } from "./src/snippet.js";
export { standardizeConfig, standardizeKey } from "./src/std.js";
export { Config as transform } from "./src/config.js";
export function init({
  idMaker,
}: {
  idMaker: (name: string) => string;
}) {
  setIdMaker(idMaker);
}
