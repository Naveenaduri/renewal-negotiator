import { suggestedVendorEmail } from "@/lib/desk";

// Public, non-secret settings the New deal page needs.
export async function GET() {
  return Response.json({ suggestedVendorEmail: suggestedVendorEmail() });
}
