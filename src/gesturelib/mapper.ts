type Mapping = (payload: any) => void;
const registry = new Map<string, Mapping>();
export function registerMapping(code: string, fn: Mapping) {
  registry.set(code, fn);
}
export function applyGesture(code: string, payload: any) {
  const fn = registry.get(code);
  if (fn) fn(payload);
}
