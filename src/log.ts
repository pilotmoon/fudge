declare global {
  // Minimal shape: fudge runs in PopClip's JS environment (no console), in
  // Node/Bun, and in browsers -- so nothing here may assume dom or node types.
  // biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
  var console: { log: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };
  // biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
  function print(...args: any[]): void;
}

// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function log(...args: any[]) {
  if (typeof print === "function") {
    print(...args);
  } else if (typeof console === "object" && typeof console.log === "function") {
    console.log(...args);
  }
}
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function loge(...args: any[]) {
  if (typeof print === "function") {
    print(...args);
  } else if (
    typeof console === "object" &&
    typeof console.error === "function"
  ) {
    console.error(...args);
  }
}
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function logw(...args: any[]) {
  if (typeof print === "function") {
    print(...args);
  } else if (
    typeof console === "object" &&
    typeof console.warn === "function"
  ) {
    console.warn(...args);
  }
}
