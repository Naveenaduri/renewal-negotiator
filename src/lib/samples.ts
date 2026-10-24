// Sample renewal emails. The emails and their prices are made up, but the vendors are real,
// so the agents research real public pricing pages for them.
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
    id: "slack",
    label: "Slack: a normal renewal",
    blurb: "50 members at $10 each a month. Slack's own pricing page lists less.",
    from: "billing@slack.com",
    subject: "Your Slack Pro plan renews on 9 December",
    body: "Hello,\n\nYour Slack Pro workspace for 50 members will renew automatically on 9 December 2026. You are billed monthly at $10.00 per member per month, which comes to $6,000 for the next 12 months.\n\nTo change your plan or your member count, reply to this email before the renewal date.\n\nSlack Billing",
  },
  {
    id: "dropbox",
    label: "Dropbox: a price increase",
    blurb: "10 users, $15 going up to $18 per user per month. Argue the rise down.",
    from: "billing@dropbox.com",
    subject: "Your Dropbox Business plan is changing on 15 December",
    body: "Hi there,\n\nYour Dropbox Business subscription for 10 users will renew on 15 December 2026. Your rate is increasing from $15 to $18 per user per month, billed monthly. That is $2,160 for the next 12 months.\n\nTo make changes, reply to this email before the renewal date.\n\nDropbox Billing",
  },
  {
    id: "gong",
    label: "Gong: no public price",
    blurb: "25 seats, $35,000 a year. The vendor does not publish prices.",
    from: "billing@gong.io",
    subject: "Your Gong subscription renews on 20 January",
    body: "Hello,\n\nYour Gong subscription for 25 seats will renew automatically on 20 January 2027 at $1,400 per seat per year, which comes to $35,000 for the next 12 months.\n\nTo adjust your seat count or term, reply to this email before the renewal date.\n\nGong Billing",
  },
];
