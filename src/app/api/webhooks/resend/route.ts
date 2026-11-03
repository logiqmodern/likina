import { connection } from "next/server";
import { getDb } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { applyResendEvent, verifySvixSignature } from "@/server/email/webhook";

/**
 * POST /api/webhooks/resend — delivery statuses (delivered / bounced /
 * complained) for the e-mail log. Signed by Resend (Svix); unsigned or
 * badly signed requests get 401. Without RESEND_WEBHOOK_SECRET: 404.
 */
export async function POST(request: Request) {
  await connection();
  const secret = serverEnv().RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  const body = await request.text();
  if (body.length > 256 * 1024) return new Response("Too large", { status: 413 });
  const now = new Date();
  const ok = verifySvixSignature(
    secret,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    body,
    now,
  );
  if (!ok) return new Response("Invalid signature", { status: 401 });
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  await applyResendEvent(getDb(), event as Parameters<typeof applyResendEvent>[1], now);
  return new Response(null, { status: 204 });
}
