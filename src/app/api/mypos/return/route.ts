import { NextResponse } from "next/server";
import { href } from "@/i18n";
import { isWellFormedToken } from "@/server/crypto";

/* myPOS sends the customer back here (URL_OK / URL_Cancel, as POST) → the order page, which reads the status from the DB. */
function back(request: Request): Response {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const lang = url.searchParams.get("l") === "en" ? "en" : "bg";
  if (!isWellFormedToken(token)) return NextResponse.redirect(new URL("/", url), 303);
  return NextResponse.redirect(new URL(href.order(lang, token), url), 303);
}

export const GET = back;
export const POST = back;
