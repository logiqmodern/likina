import type { Metadata } from "next";
import { Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/server/admin/auth";

export const metadata: Metadata = { title: "Табло" };

// Phase 0 placeholder: the shop dashboard (new orders, pending shipments,
// failed payments, inquiries) arrives with the orders in Phase 1/7.
export default async function DashboardPage() {
  await requireAdmin();
  return (
    <Panel title="Табло">
      <p className="text-[15px] text-muted">Тук ще са новите поръчки, чакащите изпращане и запитванията.</p>
    </Panel>
  );
}
