/**
 * Minimal zero-dependency frontmatter parser.
 * Only handles simple scalar key: value pairs (name, description, etc.).
 * Defensive: never throws; unparseable front matter yields empty object.
 */

/**
 * @param {string} text
 * @returns {{ frontmatter: Record<string, string>, body: string }}
 */
export function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: {}, body: text };

  const rest = text.slice(3);
  const end = rest.indexOf('\n---');
  if (end === -1) return { frontmatter: {}, body: text };

  const fmText = rest.slice(0, end);
  const body = rest.slice(end + 4).replace(/^\n/, '');
  const frontmatter = {};

  for (const line of fmText.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    let val = line.slice(colon + 1).trim();
    // Strip surrounding quotes (single or double)
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && val !== undefined) frontmatter[key] = val;
  }

  return { frontmatter, body };
}
