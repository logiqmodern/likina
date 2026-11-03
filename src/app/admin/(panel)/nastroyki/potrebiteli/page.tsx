import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/admin/common/page-parts";
import { PageHeader } from "@/components/admin/forms";
import { Panel, PanelSkeleton } from "@/components/admin/ui";
import { InviteForm } from "@/components/admin/users/invite-form";
import { RevokeInvite, UserActions } from "@/components/admin/users/user-actions";
import { getDb } from "@/db/client";
import { formatNumericDateTime, formatRecent } from "@/lib/admin-format";
import { adminSection } from "@/lib/admin-nav";
import { requireAdmin, ROLE_LABELS } from "@/server/admin/auth";
import type { AdminRole } from "@/server/admin/session";
import { listAdminUsers, manageableRoles } from "@/server/admin/users";

export const metadata: Metadata = { title: "Потребители" };

const ROLE_HELP: Record<AdminRole, string> = {
  owner: "Творби, поръчки, запитвания, настройки и потребители. Двуфакторният вход е задължителен.",
  developer: "Всичко, включително технически настройки. Двуфакторният вход е задължителен.",
};

const CHIP = "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";

/** Admin users and open invites (§10.1). Owner and developer. */
export default function UsersPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={6} />}>
      <Users />
    </Suspense>
  );
}

async function Users() {
  const me = await requireAdmin({ roles: adminSection("nastroyki").roles });
  const now = new Date();
  const { users, invites } = await listAdminUsers(getDb(), now);
  const manageable = manageableRoles(me.role);
  const roleOptions = manageable.map((r) => ({ value: r, label: ROLE_LABELS[r], help: ROLE_HELP[r] }));

  return (
    <>
      <BackLink href="/admin/nastroyki">Настройки</BackLink>
      <PageHeader
        title="Потребители"
        description="Нов потребител се добавя с покана: изпращаш му еднократен линк, а той сам избира паролата си."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="h-users">
          <h3 id="h-users" className="text-[17px] font-extrabold">
            Профили ({users.length})
          </h3>
          <ul className="flex flex-col divide-y divide-[#F1ECE4]">
            {users.map((u) => {
              const isMe = u.id === me.id;
              const canManage = !isMe && manageable.includes(u.role);
              const canResetTotp = !isMe && me.role === "developer" && manageable.includes(u.role) && u.totpEnabled;
              return (
                <li key={u.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-extrabold">{u.name}</span>
                      {isMe ? <span className={`${CHIP} bg-tint-100 text-ink`}>Ти</span> : null}
                      <span className={`${CHIP} bg-[#EEE9E2] text-ink-2`}>{ROLE_LABELS[u.role]}</span>
                      {u.isActive ? (
                        <span className={`${CHIP} bg-[#E3F2EA] text-[#1F5E3F]`}>Активен</span>
                      ) : (
                        <span className={`${CHIP} border border-dashed border-[#B8AEA3] bg-white text-ink-2`}>Деактивиран</span>
                      )}
                      {u.totpEnabled ? (
                        <span className={`${CHIP} bg-[#E3F2EA] text-[#1F5E3F]`}>2FA: включен</span>
                      ) : (
                        <span className={`${CHIP} border border-warning-border bg-warning-bg text-warning-text`}>
                          2FA: не е настроен
                        </span>
                      )}
                    </span>
                    <span className="break-all text-[14px] text-ink-2">{u.email}</span>
                    <span className="text-[13px] text-muted">
                      Последен вход: {u.lastLoginAt ? formatRecent(u.lastLoginAt, now) : "никога"}
                    </span>
                  </div>
                  <UserActions userId={u.id} name={u.name} isActive={u.isActive} canManage={canManage} canResetTotp={canResetTotp} />
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-5">
          {roleOptions.length > 0 ? (
            <Panel className="flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="h-invite">
              <h3 id="h-invite" className="text-[17px] font-extrabold">
                Покани потребител
              </h3>
              <InviteForm roles={roleOptions} />
            </Panel>
          ) : null}

          <Panel className="flex flex-col gap-3 p-4 sm:p-5" aria-labelledby="h-invites">
            <h3 id="h-invites" className="text-[17px] font-extrabold">
              Отворени покани ({invites.length})
            </h3>
            {invites.length === 0 ? (
              <p className="text-[15px] text-muted">Няма покани, които чакат.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[#F1ECE4]">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{i.name}</span>
                      <span className={`${CHIP} bg-[#EEE9E2] text-ink-2`}>{ROLE_LABELS[i.role]}</span>
                    </span>
                    <span className="break-all text-[14px] text-ink-2">{i.email}</span>
                    <span className="text-[13px] text-muted">
                      Важи до {formatNumericDateTime(i.expiresAt)} · покана от <span className="break-all">{i.createdBy}</span>
                    </span>
                    {manageable.includes(i.role) ? <RevokeInvite inviteId={i.id} email={i.email} /> : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[13px] text-muted">Линкът на поканата се вижда само веднъж — при създаването. Ако е изгубен, отмени поканата и създай нова.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
