// Text that goes to the vendor must not show our internals. Receipt labels like [R1] link
// claims to receipts inside the app (the rehearsal view keeps them); the email and replies drop them.
export function forVendor(text: string): string {
  return text
    .replace(/[ \t]*\[\s*R\d+(?:\s*(?:,|&|and)\s*R?\d+)*\s*\]/gi, "") // [R1], [R1, R2], [R2 & R3]
    .replace(/[ \t]*\((?:see\s+)?(?:receipts?|sources?|ref)\s*:?\s*R\d+(?:\s*(?:,|&|and)\s*R?\d+)*\)/gi, "") // (receipt R1)
    .replace(/[ \t]+([.,;:!?)])/g, "$1") // no space left before punctuation
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
