// Builds the closing email: concise, bold, and built around one number, what the user saved.
export type WinFacts = {
  vendor: string;
  was: number; // annual price before, USD
  now: number; // annual price the vendor offered, USD
  quote: string; // the vendor's own words
  vendorEmail: string;
  reply: string; // what the user should send next
  renews?: string | null; // human date
  link: string;
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function winEmail(f: WinFacts) {
  const saved = f.was - f.now;
  const pct = Math.round((saved / f.was) * 100);
  const subject = `You saved ${money(saved)} a year on ${f.vendor}`;

  const text = [
    `YOU SAVED ${money(saved)} PER YEAR on ${f.vendor} (${pct}% off).`,
    `Was ${money(f.was)} per year. Now ${money(f.now)} per year.`,
    "",
    `${f.vendorEmail} wrote:`,
    `"${f.quote}"`,
    "",
    "Reply with this to lock it in:",
    "-----",
    f.reply,
    "-----",
    f.renews ? `Do it before your renewal on ${f.renews}.` : "",
    "",
    `Open the full rehearsal: ${f.link}`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0c1118;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c1118;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
  <tr><td style="height:6px;background:linear-gradient(90deg,#3ee0c1,#ff9966);border-radius:6px 6px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="background:#131a24;padding:36px 32px 12px;text-align:center;border-left:1px solid #243142;border-right:1px solid #243142;">
    <div style="font-size:12px;letter-spacing:3px;color:#3ee0c1;font-weight:700;">DEAL REACHED</div>
    <div style="font-size:15px;color:#a9b6c8;margin-top:14px;">You saved</div>
    <div style="font-size:76px;line-height:1.05;font-weight:800;color:#3ee0c1;letter-spacing:-2px;margin:2px 0;">${money(saved)}</div>
    <div style="font-size:17px;color:#e8edf4;">per year on <strong>${esc(f.vendor)}</strong></div>
    <div style="display:inline-block;margin-top:16px;background:#0f2a27;color:#3ee0c1;border:1px solid #3ee0c1;border-radius:999px;padding:6px 16px;font-size:13px;font-weight:700;">${pct}% off your current price</div>
  </td></tr>
  <tr><td style="background:#131a24;padding:20px 32px;border-left:1px solid #243142;border-right:1px solid #243142;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="45%" style="background:#0c1118;border:1px solid #243142;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:11px;letter-spacing:2px;color:#7d8ca1;">WAS</div>
        <div style="font-size:26px;color:#a9b6c8;text-decoration:line-through;font-weight:700;">${money(f.was)}</div>
      </td>
      <td width="10%" style="text-align:center;color:#ff9966;font-size:24px;">&rarr;</td>
      <td width="45%" style="background:#0f2a27;border:1px solid #3ee0c1;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:11px;letter-spacing:2px;color:#3ee0c1;">NOW</div>
        <div style="font-size:26px;color:#e8edf4;font-weight:800;">${money(f.now)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#131a24;padding:4px 32px 20px;border-left:1px solid #243142;border-right:1px solid #243142;">
    <div style="font-size:11px;letter-spacing:2px;color:#ff9966;font-weight:700;margin-bottom:8px;">IN THEIR WORDS</div>
    <div style="border-left:3px solid #ff9966;padding:4px 0 4px 14px;color:#e8edf4;font-size:15px;line-height:1.55;font-style:italic;">&ldquo;${esc(f.quote)}&rdquo;</div>
    <div style="font-size:12px;color:#7d8ca1;margin-top:6px;">${esc(f.vendorEmail)}</div>
  </td></tr>
  <tr><td style="background:#131a24;padding:4px 32px 26px;border-left:1px solid #243142;border-right:1px solid #243142;">
    <div style="font-size:11px;letter-spacing:2px;color:#3ee0c1;font-weight:700;margin-bottom:8px;">REPLY WITH THIS TO LOCK IT IN</div>
    <div style="background:#eef1f6;color:#10161f;border-radius:12px;padding:16px 18px;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:14px;line-height:1.65;white-space:pre-wrap;">${esc(f.reply)}</div>
    ${f.renews ? `<div style="font-size:13px;color:#ffd166;margin-top:10px;">Send it before your renewal on ${esc(f.renews)}.</div>` : ""}
  </td></tr>
  <tr><td style="background:#131a24;padding:0 32px 32px;text-align:center;border-left:1px solid #243142;border-right:1px solid #243142;">
    <a href="${f.link}" style="display:inline-block;background:#3ee0c1;color:#06231d;font-weight:700;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:12px;">See the full rehearsal</a>
  </td></tr>
  <tr><td style="background:#0c1118;border:1px solid #243142;border-radius:0 0 6px 6px;padding:14px 32px;text-align:center;font-size:12px;color:#7d8ca1;">Renewal Negotiator &middot; your agents negotiated, you decide.</td></tr>
</table>
</td></tr></table></body></html>`;

  return { subject, text, html, saved, pct };
}
