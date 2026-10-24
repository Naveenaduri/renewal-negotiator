// Public, non-secret settings the New deal page needs.
export async function GET() {
  return Response.json({ suggestedVendorEmail: process.env.DEFAULT_VENDOR_EMAIL ?? "" });
}
