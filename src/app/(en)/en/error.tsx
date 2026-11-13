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
      <title>Something went wrong · Likina</title>
      <p className="text-sm font-bold uppercase tracking-[0.1em] text-muted">Error 500</p>
      <h1 className="text-3xl font-extrabold">Something went wrong</h1>
      <p className="text-ink-2">The page could not be loaded. Please try again shortly.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className="btn btn-primary btn-lg sm:flex-1">
          Try again
        </button>
        <Link href="/en" className="btn btn-secondary btn-lg sm:flex-1">
          Home
        </Link>
      </div>
      {error.digest ? <p className="text-xs text-muted">Error code: {error.digest}</p> : null}
    </main>
  );
}
