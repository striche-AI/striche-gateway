// simple naming helpers (exported if needed elsewhere)
export function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function routeResourceName(path: string, method: string) {
  const p = path.replace(/\{|\}/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "");
  const m = method.toLowerCase();
  return `${p}-${m}`.replace(/-+/g, "-");
}
