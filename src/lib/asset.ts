/**
 * Resolve a file in public/ against Vite's base path. GitHub project pages are
 * served from /<repo>/ rather than /, so absolute "/media" URLs would break.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return (base.endsWith("/") ? base : base + "/") + path.replace(/^\/+/, "");
}
