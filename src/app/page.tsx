import { Logo } from "@/components/site/logo";

/** Phase 0 placeholder; the gallery home page comes in Phase 4. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <Logo />
      <h1 className="text-2xl font-extrabold">Новият сайт на Likina е в разработка</h1>
    </main>
  );
}
