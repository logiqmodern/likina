import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/forms";
import { Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/server/admin/auth";

export const metadata: Metadata = { title: "Табло" };

// Phase 0 placeholder: the shop dashboard (new orders, pending shipments,
// failed payments, inquiries) arrives with the orders.
export default async function DashboardPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Добре дошли" description="Тук ще виждате новите поръчки, чакащите изпращане и запитванията." />
      <Panel className="p-5">
        <p className="text-[15px] text-ink-2">
          Творбите от стария сайт вече са в раздел „Творби“. Поръчките ще се появяват тук, когато магазинът тръгне.
        </p>
      </Panel>
    </>
  );
}
