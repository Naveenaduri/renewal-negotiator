// Made-up renewal emails for the three sample paths. Vendors are fictional;
// the pricing the agents research for real vendors comes only from fetched pages.
export type Sample = {
  id: string;
  label: string;
  blurb: string;
  from: string;
  subject: string;
  body: string;
};

export const SAMPLES: Sample[] = [
  {
    id: "pm",
    label: "Project management tool",
    blurb: "12 seats, billed monthly. Public pricing page available.",
    from: "billing@taskboard.example",
    subject: "Your Team plan renews on 14 Nov",
    body: "Hi there,\n\nYour Taskboard Team subscription will renew automatically on 14 November 2026 for 12 seats at $14 per seat per month, billed monthly. That is $2,016 for the next 12 months.\n\nIf you would like to change your plan or seat count, reply to this email before the renewal date.\n\nThanks,\nTaskboard Billing",
  },
  {
    id: "host",
    label: "Domain and hosting",
    blurb: "Renewal after an intro price. Yearly term.",
    from: "renewals@hostwell.example",
    subject: "Your domain and hosting renew on 2 Dec",
    body: "Hello,\n\nYour Hostwell Business hosting plan and one domain will renew on 2 December 2026 at the standard yearly rate of $312. Your first-year promotional price has ended.\n\nTo make changes, sign in to your account before the renewal date.\n\nHostwell Renewals",
  },
  {
    id: "cloud",
    label: "Cloud storage",
    blurb: "Storage tier upsell at renewal. Per-user pricing.",
    from: "accounts@cloudnest.example",
    subject: "Renewal notice: Cloudnest Teams, 8 users",
    body: "Hi,\n\nYour Cloudnest Teams plan for 8 users renews on 20 December 2026 at $15 per user per month, billed yearly. We noticed you are close to your storage limit and recommend upgrading to the Business tier.\n\nReply to this email to discuss your options.\n\nCloudnest Accounts",
  },
];
