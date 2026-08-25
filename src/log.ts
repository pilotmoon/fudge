// Log to whatever the host provides, declaring no globals: fudge runs in
// PopClip's JS environment (print, no console), in Node/Bun, and in projects
// that declare their own console type -- an ambient declaration here would
// conflict with theirs.
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
type LogFunction = (...args: any[]) => void;
const host = globalThis as {
  print?: LogFunction;
  console?: { log?: LogFunction; error?: LogFunction; warn?: LogFunction };
};

// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function log(...args: any[]) {
  if (typeof host.print === "function") {
    host.print(...args);
  } else if (typeof host.console?.log === "function") {
    host.console.log(...args);
  }
}
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function loge(...args: any[]) {
  if (typeof host.print === "function") {
    host.print(...args);
  } else if (typeof host.console?.error === "function") {
    host.console.error(...args);
  }
}
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function logw(...args: any[]) {
  if (typeof host.print === "function") {
    host.print(...args);
  } else if (typeof host.console?.warn === "function") {
    host.console.warn(...args);
  }
}
