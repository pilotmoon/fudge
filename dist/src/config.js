export function transform(val, fn) {
    if (typeof val !== "object" || val === null)
        return val;
    const result = {};
    for (const [key, obj] of Object.entries(val)) {
        if (Array.isArray(obj)) {
            result[fn(key)] = obj.map((item) => transform(item, fn));
        }
        else {
            result[fn(key)] = transform(obj, fn);
        }
    }
    return result;
}
