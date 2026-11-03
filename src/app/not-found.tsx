import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Страницата не е намерена" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.1em] text-muted">404</p>
      <h1 className="text-3xl font-extrabold">Страницата не е намерена</h1>
      <p className="text-ink-2">Адресът може да е стар или грешен. Разгледайте творбите в галерията.</p>
      <Link href="/" className="btn btn-primary btn-lg">
        Към началото
      </Link>
    </main>
  );
}
