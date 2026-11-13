import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

/* 404 for URLs no route matches (two root layouts: BG and EN). Bilingual, no data. */
export const metadata: Metadata = { title: "404 · Likina", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="bg" className="h-full">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.1em] text-muted">404</p>
          <h1 className="text-3xl font-extrabold">Страницата не е намерена</h1>
          <p className="text-ink-2">Адресът може да е стар или грешен.</p>
          <Link href="/galeriya" className="btn btn-primary btn-lg">
            Към галерията
          </Link>
          <p lang="en" className="text-ink-2">
            Page not found. <Link href="/en/gallery" className="font-semibold underline underline-offset-4">
              Go to the gallery
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
