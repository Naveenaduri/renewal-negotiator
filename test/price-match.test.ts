import { describe, expect, it } from "vitest";

import { priceAppearsIn, priceTokens } from "@/lib/price-match";

describe("priceTokens", () => {
  it("extracts amounts without separators", () => {
    expect(priceTokens("$1,299.00/mo")).toEqual(["1299.00", "1299"]);
    expect(priceTokens("Contact sales")).toEqual([]);
  });
});

describe("priceAppearsIn", () => {
  it("matches numbers regardless of formatting", () => {
    expect(priceAppearsIn("$1,299/mo", ["Enterprise **$1299** per month"])).toBe(true);
    expect(priceAppearsIn("$10", ["Basic $10 per user/month"])).toBe(true);
  });
  it("does not match partial numbers or missing prices", () => {
    expect(priceAppearsIn("$10", ["Pro $100 per seat"])).toBe(false);
    expect(priceAppearsIn("$10", ["Pro $1.10 per seat"])).toBe(false);
    expect(priceAppearsIn("Contact sales", ["Pro $10"])).toBe(false);
  });
});
