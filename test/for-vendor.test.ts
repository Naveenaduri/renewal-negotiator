import { describe, expect, it } from "vitest";

import { forVendor } from "@/lib/for-vendor";

describe("forVendor", () => {
  it("removes receipt labels and keeps the sentence intact", () => {
    expect(forVendor("Slack lists Pro at $8.75 per user per month when paying monthly [R1]. Please credit us.")).toBe(
      "Slack lists Pro at $8.75 per user per month when paying monthly. Please credit us.",
    );
    expect(forVendor("Teams Essentials is $4.00 [R3], and $7.25 annually [R1, R2].")).toBe("Teams Essentials is $4.00, and $7.25 annually.");
    expect(forVendor("Annual is $7.25 (receipt R2) per user.")).toBe("Annual is $7.25 per user.");
  });
  it("keeps line breaks and normal brackets", () => {
    expect(forVendor("Hello,\n\nOur proposal [R1]:\n$5.75 [draft]")).toBe("Hello,\n\nOur proposal:\n$5.75 [draft]");
  });
});
