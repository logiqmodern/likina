import { after } from "next/server";

/*
 * Telegram notifications to the atelier (§10.3). Needs TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_IDS (comma-separated); without them it does nothing
 * (TODO-CLIENT: the values from the old WordPress plugin, OPEN-QUESTIONS Q10).
 * Sent after the response; a failure never affects the customer.
 */
export function notifyTelegram(text: string): void {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chats = (process.env.TELEGRAM_CHAT_IDS ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  if (!token || chats.length === 0) return;
  after(async () => {
    for (const chat of chats) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) console.warn(`[telegram] ${res.status}`);
      } catch (error) {
        console.warn("[telegram] failed:", (error as Error).message);
      }
    }
  });
}
