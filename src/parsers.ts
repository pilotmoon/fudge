import { parse as parsePlist } from "fast-plist";
import { JSON_SCHEMA, load as parseYaml } from "js-yaml";
import { ValiError, parse, record, unknown } from "valibot";

const VConfigObject = record(unknown());

export function parsePlistObject(plist: string) {
  try {
    return parse(
      VConfigObject,
      parsePlist(
        // remove any Credits array, as there are invalid ones out there
        plist.replace(/<key>Credits<\/key>\s*<array>[\s\S]*?<\/array>/, ""),
      ),
    );
  } catch (e) {
    if (e instanceof ValiError) {
      throw new Error(`Invalid config: ${e.message}`);
    }
    if (e instanceof Error) {
      throw new Error(`Invalid plist: ${e.message}`);
    }
    throw new Error("Invalid plist");
  }
}

export function parseJsonObject(jsonSource: string) {
  try {
    return parse(VConfigObject, JSON.parse(jsonSource));
  } catch (e) {
    if (e instanceof ValiError) {
      throw new Error(`Invalid config: ${e.message}`);
    }
    if (e instanceof Error) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    throw new Error("Invalid JSON");
  }
}

export function parseYamlObject(yamlSource: string) {
  try {
    return parse(VConfigObject, parseYaml(yamlSource, { schema: JSON_SCHEMA }));
  } catch (e) {
    if (e instanceof ValiError) {
      throw new Error(`Invalid config: ${e.message}`);
    }
    if (e instanceof Error) {
      throw new Error(`Invalid YAML: ${e.message}`);
    }
    throw new Error("Invalid YAML");
  }
}
