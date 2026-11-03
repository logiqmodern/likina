import Link from "next/link";
import { Panel } from "@/components/admin/ui";

export default function AdminNotFound() {
  return (
    <Panel className="flex flex-col items-start gap-3 p-6">
      <h2 className="text-lg font-extrabold">Страницата не е намерена</h2>
      <p className="text-[15px] text-ink-2">Няма такава страница или нямаш достъп до нея.</p>
      <Link href="/admin" className="link flex min-h-11 items-center">
        Към таблото
      </Link>
    </Panel>
  );
}
