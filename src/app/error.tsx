"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Error boundary for every page under the root layout (500, §4). */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16 text-center">
      <title>Нещо се обърка · Likina</title>
      <p className="text-sm font-bold uppercase tracking-[0.1em] text-muted">Грешка 500</p>
      <h1 className="text-3xl font-extrabold">Нещо се обърка</h1>
      <p className="text-ink-2">Страницата не успя да се зареди. Опитайте отново след малко.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className="btn btn-primary btn-lg sm:flex-1">
          Опитайте отново
        </button>
        <Link href="/" className="btn btn-secondary btn-lg sm:flex-1">
          Към началото
        </Link>
      </div>
      {error.digest ? <p className="text-xs text-muted">Код на грешката: {error.digest}</p> : null}
    </main>
  );
}
