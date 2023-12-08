import { parse as parsePlist } from "fast-plist";
import { load as parseYaml, JSON_SCHEMA } from "js-yaml";
import { z } from "zod";
const ZConfigObject = z.record(z.unknown());
export function parsePlistObject(plist) {
    try {
        return ZConfigObject.parse(parsePlist(
        // remove any Credits array, as there are invalid ones out there
        plist.replace(/<key>Credits<\/key>\s*<array>[\s\S]*?<\/array>/, "")));
    }
    catch (e) {
        if (e instanceof z.ZodError) {
            throw new Error("Invalid config");
        }
        if (e instanceof Error) {
            throw new Error(`Invalid plist: ${e.message}`);
        }
        throw new Error("Invalid plist");
    }
}
export function parseYamlObject(yamlSource) {
    try {
        return ZConfigObject.parse(parseYaml(yamlSource, {
            schema: JSON_SCHEMA,
        }));
    }
    catch (e) {
        if (e instanceof z.ZodError) {
            throw new Error("Invalid config");
        }
        if (e instanceof Error) {
            throw new Error(`Invalid YAML: ${e.message}`);
        }
        throw new Error("Invalid YAML");
    }
}
