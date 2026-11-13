import { redirectLegacyProduct } from "@/server/legacy-redirect";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return redirectLegacyProduct(request, (await params).slug, "en");
}
