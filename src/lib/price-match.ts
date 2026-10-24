/**
 * Receipt check: does a claimed price actually appear on the fetched page?
 * Used by the Researcher (before saving a receipt) and the Verifier.
 * Never invent a price: if this returns false, the claim is unverified.
 */

/** Numeric amounts in a price string: "$1,299.00/mo" → ["1299.00", "1299"]. */
export function priceTokens(price: string): string[] {
  const out = new Set<string>();
  for (const m of price.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/,/g, "");
    out.add(raw);
    out.add(raw.replace(/\.0+$/, ""));
  }
  return [...out].filter(Boolean);
}

/** True when any numeric amount of `price` appears as a standalone number in the page passages. */
export function priceAppearsIn(price: string, passages: string[]): boolean {
  const tokens = priceTokens(price);
  if (!tokens.length) return false;
  const text = passages.join("\n").replace(/(\d),(\d)/g, "$1$2");
  return tokens.some((t) => new RegExp(`(^|[^\\d.])${t.replace(".", "\\.")}(?![\\d])`).test(text));
}
