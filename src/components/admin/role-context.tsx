"use client";

import { createContext, useContext } from "react";
import type { AdminRoleName } from "@/lib/admin-nav";

/**
 * The signed-in admin's role for client components that hide controls.
 * UI only — the server actions enforce the rules.
 */
const RoleContext = createContext<AdminRoleName>("owner");

export function AdminRoleProvider({ role, children }: { role: AdminRoleName; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useAdminRole(): AdminRoleName {
  return useContext(RoleContext);
}

