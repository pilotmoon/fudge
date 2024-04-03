declare global {
  // biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
  // biome-ignore lint/style/noVar: go away
  var console: Console;
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
