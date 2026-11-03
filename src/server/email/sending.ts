import { serverEnv } from "@/lib/env";

/**
 * Whether e-mails really go out (a Resend API key is configured). Without it
 * the outbox renders messages and marks them "logged" instead of sending.
 * Never exposes the key itself.
 */
export function emailSendingConfigured(): boolean {
  return Boolean(serverEnv().RESEND_API_KEY);
}
