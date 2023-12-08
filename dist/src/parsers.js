"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseYamlObject = exports.parsePlistObject = void 0;
const fast_plist_1 = require("fast-plist");
const js_yaml_1 = __importDefault(require("js-yaml"));
const zod_1 = require("zod");
const ZConfigObject = zod_1.z.record(zod_1.z.unknown());
function parsePlistObject(plist) {
    try {
        return ZConfigObject.parse((0, fast_plist_1.parse)(
        // remove any Credits array, as there are invalid ones out there
        plist.replace(/<key>Credits<\/key>\s*<array>[\s\S]*?<\/array>/, "")));
    }
    catch (e) {
        if (e instanceof zod_1.z.ZodError) {
            throw new Error("Invalid config");
        }
        else if (e instanceof Error) {
            throw new Error("Invalid plist: " + e.message);
        }
        else {
            throw new Error("Invalid plist");
        }
    }
}
exports.parsePlistObject = parsePlistObject;
function parseYamlObject(yamlSource) {
    try {
        return ZConfigObject.parse(js_yaml_1.default.load(yamlSource, {
            schema: js_yaml_1.default.JSON_SCHEMA,
        }));
    }
    catch (e) {
        if (e instanceof zod_1.z.ZodError) {
            throw new Error("Invalid config");
        }
        else if (e instanceof Error) {
            throw new Error("Invalid YAML: " + e.message);
        }
        else {
            throw new Error("Invalid YAML");
        }
    }
}
exports.parseYamlObject = parseYamlObject;
