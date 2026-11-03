/*
 * Where rendered e-mails go. Resend in production; without RESEND_API_KEY the
 * "log" transport keeps them in the admin log only (status "logged").
 * NotificationChannel (§6): SMS / Viber can be added later as other channels.
 */

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
  /** same key → Resend sends once (retries after a timeout are safe) */
  idempotencyKey: string;
  tags?: Record<string, string>;
}

export interface NotificationChannel<M> {
  readonly name: string;
  send(message: M): Promise<{ id: string }>;
}

export type EmailTransport = NotificationChannel<OutgoingEmail> & { readonly name: "resend" | "log" | "memory" };

export class TransportError extends Error {
  constructor(
    message: string,
    /** false = retrying cannot help (invalid address, rejected content) */
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TransportError";
  }
}

export function resendTransport(apiKey: string, fetchImpl: typeof fetch = fetch): EmailTransport {
  return {
    name: "resend",
    async send(m) {
      let res: Response;
      try {
        res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": m.idempotencyKey,
          },
          body: JSON.stringify({
            from: m.from,
            to: [m.to],
            ...(m.replyTo ? { reply_to: m.replyTo } : {}),
            subject: m.subject,
            html: m.html,
            text: m.text,
            ...(m.attachments?.length
              ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content, content_type: a.contentType })) }
              : {}),
            ...(m.tags ? { tags: Object.entries(m.tags).map(([name, value]) => ({ name, value })) } : {}),
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        throw new TransportError(`network: ${(error as Error).message}`, true);
      }
      const body = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
      if (res.ok && body?.id) return { id: body.id };
      const message = `resend ${res.status}: ${body?.name ?? ""} ${body?.message ?? ""}`.trim();
      // 400 / 422: the message itself is invalid (bad address, …) — retrying won't help.
      throw new TransportError(message, !(res.status === 400 || res.status === 422), res.status);
    },
  };
}

/** No API key: nothing leaves the server; the admin log shows the rendered e-mail. */
export const logTransport: EmailTransport = {
  name: "log",
  async send(m) {
    console.log(`[email:log] ${m.tags?.kind ?? "email"} → ${m.to}: ${m.subject}`);
    return { id: `log_${m.idempotencyKey}` };
  },
};

/** Tests: collects what would be sent. */
export function memoryTransport(opts: { fail?: (m: OutgoingEmail) => TransportError | null } = {}) {
  const sent: OutgoingEmail[] = [];
  const t: EmailTransport & { sent: OutgoingEmail[] } = {
    name: "memory",
    sent,
    async send(m) {
      const err = opts.fail?.(m);
      if (err) throw err;
      sent.push(m);
      return { id: `mem_${sent.length}` };
    },
  };
  return t;
}

export function transportFromEnv(apiKey: string | undefined): EmailTransport {
  return apiKey ? resendTransport(apiKey) : logTransport;
}
