/**
 * "hiking, biking on the boardwalk; gardening" -> ["Hiking", "Biking on the boardwalk", "Gardening"].
 * Splits at commas, semicolons and line breaks (not at "and", so "Arts and
 * crafts" stays whole), tidies spaces, capitalizes the first letter and drops
 * duplicates. Matching to existing interests ignores case, in the database.
 */
export function splitInterests(text: string, max = 20) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(/[,;\n]+/)) {
    const tidied = part.replace(/\s+/g, " ").trim().slice(0, 80);
    const key = tidied.toLowerCase();
    if (!tidied || seen.has(key)) continue;
    seen.add(key);
    result.push(tidied.charAt(0).toUpperCase() + tidied.slice(1));
    if (result.length === max) break;
  }
  return result;
}
