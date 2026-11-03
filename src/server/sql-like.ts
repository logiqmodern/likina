/** `%term%` for ILIKE with the user's own % and _ taken literally. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}
