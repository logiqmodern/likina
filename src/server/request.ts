import { headers } from "next/headers";

/** Visitor IP from the proxy headers (Caddy / Vercel); "unknown" when absent. For rate limits only. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
