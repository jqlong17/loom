/**
 * Convert a title string into a filesystem-safe slug.
 * Supports ASCII and common CJK characters.
 */
export function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
