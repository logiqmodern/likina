import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.1em] text-muted">404</p>
      <h1 className="text-3xl font-extrabold">Page not found</h1>
      <p className="text-ink-2">The address may be old or mistyped. Have a look at the shop.</p>
      <Link href="/en/shop" className="btn btn-primary btn-lg">
        Go to the shop
      </Link>
    </main>
  );
}
