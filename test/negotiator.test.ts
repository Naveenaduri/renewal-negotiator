import { beforeEach, describe, expect, it, vi } from "vitest";

// Never hit the live API in tests: mock the wrapper module.
vi.mock("@/lib/context-dev", () => ({
  answer: vi.fn(),
  searchWeb: vi.fn(),
  capturePageEvidence: vi.fn(),
}));

import { answer, capturePageEvidence, searchWeb } from "@/lib/context-dev";
import { priceAppearsIn, researchRenewal } from "@/lib/negotiator";

const mockedAnswer = vi.mocked(answer);
const mockedSearch = vi.mocked(searchWeb);
const mockedCapture = vi.mocked(capturePageEvidence);

const evidence = (url: string, highlights: string[]) => ({
  requestedUrl: url,
  finalUrl: url,
  title: "Pricing",
  screenshot: "data:image/jpeg;base64,AAAA",
  highlights,
  isPartial: false,
  cache: { status: "miss", ageMs: 0 },
  capturedAt: "2026-01-01T00:00:00.000Z",
  requestId: "req-scrape",
  creditsConsumed: 2,
});

beforeEach(() => vi.resetAllMocks());

describe("priceAppearsIn", () => {
  it("matches numbers regardless of formatting", () => {
    expect(priceAppearsIn("$1,299/mo", ["Enterprise **$1299** per month"])).toBe(true);
    expect(priceAppearsIn("$10", ["Pro $10 per seat"])).toBe(true);
    expect(priceAppearsIn("$10", ["Pro $100 per seat"])).toBe(false);
    expect(priceAppearsIn("Contact sales", ["Pro $10"])).toBe(false);
  });
});

describe("researchRenewal", () => {
  it("gives every price a source URL + screenshot and verifies price text", async () => {
    mockedAnswer.mockResolvedValue({
      data: {
        vendor: { name: "Acme", website: "acme.com", pricing_page_url: "https://acme.com/pricing" },
        plans: [
          { name: "Pro", price: "$10", billing_period: "per user/month", source_url: "https://acme.com/pricing" },
          { name: "Business", price: "$20", billing_period: "per user/month", source_url: null },
          { name: "Enterprise", price: null, billing_period: null, source_url: null },
        ],
        alternatives: [{ name: "Rival", website: "rival.io", plan_name: "Team", price: "$8", billing_period: "per user/month", source_url: null }],
        negotiation_levers: ["Rival is 20% cheaper", null],
      },
      sources: ["https://acme.com/pricing"],
      partial: false,
      requestId: "req-answers",
      creditsConsumed: 10,
    });
    mockedSearch.mockResolvedValue({
      results: [{ url: "https://rival.io/pricing", title: "Rival pricing", description: "", relevance: "high" }],
      requestId: "req-search",
      creditsConsumed: 1,
    });
    mockedCapture.mockImplementation(async ({ url }) =>
      url.includes("acme") ? evidence(url, ["Pro $10 per user", "Business $25 per user"]) : evidence(url, ["Team $8"]),
    );

    const report = await researchRenewal({ vendor: "Acme" });

    expect(mockedAnswer).toHaveBeenCalledOnce();
    expect(mockedAnswer.mock.calls[0][0].mode).toBe("fast");
    expect(mockedSearch).toHaveBeenCalledOnce(); // only Rival lacked a source
    expect(mockedCapture).toHaveBeenCalledTimes(2); // one capture per unique URL
    const byPlan = Object.fromEntries(report.pricePoints.map((p) => [p.plan, p]));
    expect(byPlan.Pro).toMatchObject({ status: "verified", sourceOrigin: "answers", sourceUrl: "https://acme.com/pricing" });
    expect(byPlan.Business).toMatchObject({ status: "captured", sourceOrigin: "pricing_page" }); // $20 not on page
    expect(byPlan.Enterprise).toMatchObject({ price: null, note: "No public price listed" });
    expect(byPlan.Team).toMatchObject({ status: "verified", sourceOrigin: "search", sourceUrl: "https://rival.io/pricing" });
    for (const p of report.pricePoints) expect(report.evidence[p.evidenceId!].screenshot).toMatch(/^data:image\//);
    expect(report.negotiationLevers).toEqual(["Rival is 20% cheaper"]);
    expect(report.creditsConsumed).toBe(10 + 1 + 2 + 2);
  });

  it("caps captures, passes fresh=true as maxAgeMs 0, and survives a failed capture", async () => {
    mockedAnswer.mockResolvedValue({
      data: {
        plans: [
          { name: "A", price: "$1", source_url: "https://a.com/pricing" },
          { name: "B", price: "$2", source_url: "https://b.com/pricing" },
          { name: "C", price: "$3", source_url: "https://c.com/pricing" },
        ],
      },
      sources: [],
      partial: true,
      requestId: "r",
    });
    mockedCapture.mockImplementation(async ({ url }) => {
      if (url.includes("b.com")) throw new Error("WEBSITE_BLOCKED");
      return evidence(url, ["$1"]);
    });

    const report = await researchRenewal({ vendor: "X", maxEvidence: 2, fresh: true });

    expect(mockedCapture).toHaveBeenCalledTimes(2);
    expect(mockedCapture.mock.calls.every(([opts]) => opts.maxAgeMs === 0)).toBe(true);
    expect(report.pricePoints.map((p) => p.status)).toEqual(["verified", "not_captured", "not_captured"]);
    expect(report.warnings.join(" ")).toMatch(/partial/);
    expect(report.warnings.join(" ")).toMatch(/Captured 2 of 3/);
    expect(report.warnings.join(" ")).toMatch(/WEBSITE_BLOCKED/);
  });
});
