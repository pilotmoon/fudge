import { standardizeIcon, type IconParams } from "./src/icon.js";
const sy = require("fast-stable-stringify");
import axios from "axios";

const testData = [
  {
    specifier: "A",
  },
  {
    specifier: "move-x=9 +",
  },
  {
    specifier: " ",
  },
  {
    specifier: "text:[[AB]]",
  },
  {
    specifier: "text:square filled Z",
  },
  {
    specifier: "text:A",
  },
  {
    specifier: "text:AB",
    extraParams: { preserveColor: true },
  },
  {
    specifier: "square circle A",
  },
  {
    specifier: "circle square filled A",
  },
  {
    specifier: "preserve_aspect symbol:hand.raised",
    extraParams: {
      preserveAspect: false,
      move_x: 10,
      url: "fdf",
      requirements: ["path"],
    },
  },
  {
    specifier:
      "preserve_aspect flip-y flip-x moveY=100 move-x=50 rotate=90 scale=99 filled strike square monospaced text:P",
  },
  {
    specifier: "😍",
  },
  {
    specifier: "preserve_COLOR=0 😍",
  },
  {
    specifier: "flip_x iconify:mdi:home",
  },
  {
    specifier: ": :",
  },
  {
    specifier: "square : :",
  },
  {
    specifier: "file.PN",
  },
  {
    specifier: "file.PNG",
  },
  {
    specifier: "icons/file.svg",
  },
  {
    specifier: "校.svg",
  },
  {
    specifier: "shape=circle file:校.svg",
  },
  {
    specifier: "circle=0 flip-x=0 A",
  },
  {
    specifier: "circle scale=100 A",
  },
];

async function parseRemotely(specifier: string, extraParams: IconParams) {
  function querify(val: unknown) {
    if (typeof val === "boolean") {
      return val ? "1" : "0";
    } else if (typeof val === "number") {
      return val.toString();
    } else if (typeof val === "string") {
      return val;
    } else {
      return "unk";
    }
  }

  // fetch e.g. http://localhost:58906/icon?format=json&specifier=ABC&square=1&flip-x=1
  const params: Record<string, string> = {
    format: "json",
    specifier,
  };
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    params[key] = querify(value);
  }
  try {
    const { data } = await axios.get("http://127.0.0.1:58906/icon", {
      params,
      paramsSerializer: {
        encode: (param) => encodeURIComponent(param),
      },
    });
    return data;
  } catch (err) {
    return { error: (err as any).response?.data };
  }
}

console.log("standardizeIcon");
let count = 0;
const fails: number[] = [];

for (const { specifier, extraParams } of testData) {
  console.log(`\nTEST ${++count}:`);
  console.log(specifier, extraParams);
  const remoteExpected = await parseRemotely(
    specifier,
    extraParams as IconParams,
  );
  console.log("remoteExpected", remoteExpected);
  const result = standardizeIcon(specifier, (extraParams as IconParams) ?? {});
  console.log("result", result);

  // compare results
  delete (result as any).ok;
  delete (result as any).specifier;
  if (sy(result) === sy(remoteExpected)) {
    console.log("✅");
  } else {
    console.log("😑😑😑", sy(result), sy(remoteExpected));
    fails.push(count);
  }
}

console.log("tests", count, "fails", fails.length, fails);
