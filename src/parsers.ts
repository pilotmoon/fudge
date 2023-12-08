import { parse as parsePlist } from "fast-plist";
import jsYaml from "js-yaml";
import { z } from "zod";

const ZConfigObject = z.record(z.unknown());

export function parsePlistObject(plist: string) {
  try {
    return ZConfigObject.parse(
      parsePlist(
        // remove any Credits array, as there are invalid ones out there
        plist.replace(/<key>Credits<\/key>\s*<array>[\s\S]*?<\/array>/, ""),
      ),
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error("Invalid config");
    } else if (e instanceof Error) {
      throw new Error("Invalid plist: " + e.message);
    } else {
      throw new Error("Invalid plist");
    }
  }
}

export function parseYamlObject(yamlSource: string) {
  try {
    return ZConfigObject.parse(
      jsYaml.load(yamlSource, {
        schema: jsYaml.JSON_SCHEMA,
      }),
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw new Error("Invalid config");
    } else if (e instanceof Error) {
      throw new Error("Invalid YAML: " + e.message);
    } else {
      throw new Error("Invalid YAML");
    }
  }
}
