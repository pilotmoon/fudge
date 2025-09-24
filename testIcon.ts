import { standardizeIcon } from "./src/icon.js";

// const _sy = require("fast-stable-stringify");

// import axios from "axios";

const testData = [
  {
    specifier: "A",
  },
  {
    specifier: "move-x=9 +",
  },
  // {
  //   specifier: " ",
  // },
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
  // {
  //   specifier: "file.PN",
  // },
  // {
  //   specifier: "file.PNG",
  // },
  // {
  //   specifier: "icons/file.svg",
  // },
  // {
  //   specifier: "校.svg",
  // },
  // {
  //   specifier: "shape=circle file:校.svg",
  // },
  {
    specifier: "circle=0 flip-x=0 A",
  },
  {
    specifier: "circle scale=100 A",
  },
  {
    specifier: "circle scale=b A",
  },
  {
    specifier: "circle flip-x=1 A",
  },
  {
    specifier: `svg:<svg enable-background="new 0 0 510 510" version="1.1" viewBox="0 0 510 510"
    xml:space="preserve" xmlns="http://www.w3.org/2000/svg"><polygon points="255 402.21 412.59 497.25 370.9 318.01 510 197.47 326.63 181.74 255 12.75 183.37 181.74 0 197.47 139.1 318.01 97.41 497.25"/></svg>`,
  },
  {
    specifier: "text:[[AB]]",
  },
];

// async function _parseRemotely(specifier: string, extraParams: unknown) {
//   function querify(val: unknown) {
//     if (typeof val === "boolean") {
//       return val ? "1" : "0";
//     }
//     if (typeof val === "number") {
//       return val.toString();
//     }
//     if (typeof val === "string") {
//       return val;
//     }
//     return "unk";
//   }

//   // fetch e.g. http://localhost:58906/icon?format=json&specifier=ABC&square=1&flip-x=1
//   const params: Record<string, string> = {
//     format: "json",
//     specifier,
//   };
//   for (const [key, value] of Object.entries(extraParams ?? {})) {
//     params[key] = querify(value);
//   }
//   try {
//     const { data } = await axios.get("http://127.0.0.1:58906/icon", {
//       params,
//       paramsSerializer: {
//         encode: (param) => encodeURIComponent(param),
//       },
//     });
//     return data;
//   } catch (err) {
//     return { error: (err as any).response?.data };
//   }
// }

console.log("standardizeIcon");
let count = 0;
const fails: number[] = [];

for (const { specifier, extraParams } of testData) {
  console.log(`\nTEST ${++count}:`);
  console.log(specifier, extraParams);
  // const remoteExpected = await parseRemotely(specifier, extraParams);
  // console.log("remoteExpected", remoteExpected);
  const result = standardizeIcon(specifier, extraParams ?? {});
  console.log("result", result);

  // // compare results
  // if (sy(result.result) === sy(remoteExpected)) {
  //   console.log("✅");
  // } else {
  //   //console.log("😑😑😑", sy(result.result), sy(remoteExpected));
  //   fails.push(count);
  // }
}

console.log("tests", count, "fails", fails.length, fails);
