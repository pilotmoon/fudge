type Transformable = Config | string | number | boolean | null;
export interface Config {
  [key: string]: Transformable | Transformable[];
}

export function transformConfig(
  val: Transformable,
  fn: (key: string) => string,
) {
  if (typeof val !== "object" || val === null) return val;

  const result: Config = {};
  for (const [key, obj] of Object.entries(val)) {
    if (Array.isArray(obj)) {
      result[fn(key)] = obj.map((item) => transformConfig(item, fn));
    } else {
      result[fn(key)] = transformConfig(obj, fn);
    }
  }
  return result;
}
