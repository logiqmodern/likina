import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/forms";
import { Panel, PanelSkeleton } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { SELLER } from "@/domain/contacts";
import { adminSection } from "@/lib/admin-nav";
import { requireAdmin } from "@/server/admin/auth";
import { loadContacts } from "@/server/email/config";

export const metadata: Metadata = { title: "Настройки" };

/** Phase 0: read-only contacts + links. Editable contacts and shop rules arrive with the admin (Phase 7). */
export default function SettingsPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={6} />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireAdmin({ roles: adminSection("nastroyki").roles });
  const contacts = await loadContacts(getDb());

  return (
    <>
      <PageHeader title="Настройки" description="Контактите се показват в сайта, в имейлите и в правните страници." />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel className="flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="h-contacts">
          <h3 id="h-contacts" className="text-[17px] font-extrabold">
            Контакти
          </h3>
          <dl className="flex flex-col gap-3 text-[15px]">
            <Row label="Телефон" value={contacts.phone} />
            <Row label="Имейл" value={contacts.email} />
            <Row label="Адрес на ателието" value={`${contacts.street}, ${contacts.city}`} />
            <Row label="Работно време" value={contacts.hoursBg} />
          </dl>
        </Panel>
        <Panel className="flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="h-seller">
          <h3 id="h-seller" className="text-[17px] font-extrabold">
            Продавач (правни данни)
          </h3>
          <dl className="flex flex-col gap-3 text-[15px]">
            <Row label="Име" value={`${SELLER.name}, ${SELLER.status}`} />
            <Row label="ЕИК" value={SELLER.eik} />
            <Row label="Адрес по регистрация" value={SELLER.address} />
            <Row label="ДДС" value={SELLER.vatRegistered ? "Регистрирана" : "Без регистрация по ДДС"} />
          </dl>
        </Panel>
      </div>

      <Panel className="flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="h-more">
        <h3 id="h-more" className="text-[17px] font-extrabold">
          Още
        </h3>
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <li>
            <Link href="/admin/nastroyki/potrebiteli" className="btn btn-secondary min-h-11 w-full px-4 text-[15px] sm:w-auto">
              Потребители и покани
            </Link>
          </li>
          <li>
            <Link href="/admin/nastroyki/odit" className="btn btn-secondary min-h-11 w-full px-4 text-[15px] sm:w-auto">
              Одит лог (кой какво е променил)
            </Link>
          </li>
        </ul>
      </Panel>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="break-words font-bold">{value}</dd>
    </div>
  );
}
