/**
 * Admin navigation and section access (§10.1, §10.2). Shared by the server
 * (page guards) and the client nav — keep it free of server imports.
 */

export type AdminRoleName = "owner" | "developer";

export type AdminSectionKey = "tablo" | "tvorbi" | "porachki" | "zapitvaniya" | "nastroyki";

export interface AdminSection {
  key: AdminSectionKey;
  href: string;
  label: string;
  roles: readonly AdminRoleName[];
}

const ALL: readonly AdminRoleName[] = ["owner", "developer"];

/**
 * §10: the owner sees the same few sections as the developer — the admin must
 * stay simple for a non-technical client. Sections arrive with their phases.
 */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: "tablo", href: "/admin", label: "Табло", roles: ALL },
  { key: "tvorbi", href: "/admin/tvorbi", label: "Творби", roles: ALL },
  { key: "porachki", href: "/admin/porachki", label: "Поръчки", roles: ALL },
  { key: "zapitvaniya", href: "/admin/zapitvaniya", label: "Запитвания", roles: ALL },
  { key: "nastroyki", href: "/admin/nastroyki", label: "Настройки", roles: ALL },
];

/** Bottom tab bar on phones; everything else is under „Още“. */
export const MOBILE_TAB_KEYS: readonly AdminSectionKey[] = ["tablo", "tvorbi", "porachki"];

export function adminSection(key: AdminSectionKey): AdminSection {
  const section = ADMIN_SECTIONS.find((s) => s.key === key);
  if (!section) throw new Error(`unknown admin section ${key}`);
  return section;
}

export function sectionsForRole(role: AdminRoleName): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => s.roles.includes(role));
}

/** Section whose page is open: exact match for /admin, prefix match otherwise. */
export function activeSection(pathname: string): AdminSection | null {
  if (pathname === "/admin" || pathname === "/admin/") return adminSection("tablo");
  return ADMIN_SECTIONS.find((s) => s.href !== "/admin" && (pathname === s.href || pathname.startsWith(`${s.href}/`))) ?? null;
}
