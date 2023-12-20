declare global {
  // biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
  var console: any;
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
  } else if (typeof console === "object" && typeof console.err === "function") {
    console.err(...args);
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
