import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Agency roles: `super_admin` (everything) and `agency_staff` (read + launch,
 * no plan or seat changes). Client roles: `client_admin` and `client_user`,
 * each bound to one client. `admin` / `agency` / `client` are legacy values
 * kept for accounts created before this model.
 */
export type AppRole =
  | "super_admin"
  | "agency_staff"
  | "client_admin"
  | "client_user"
  | "admin"
  | "agency"
  | "client";

/**
 * Loads the signed-in user's roles from `user_roles`.
 *
 * SECURITY: authorization is enforced server-side (RLS and the CRM gateway
 * reading `user_roles` + `client_memberships`). This hook is for UI gating.
 */
export function useUserRole(userId: string | undefined) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const has = (role: AppRole) => roles.includes(role);

  const isSuperAdmin = has("super_admin");
  const isAgencyStaff = has("agency_staff") || has("agency");
  const isAdmin = has("admin");
  const isAgency = isSuperAdmin || isAgencyStaff || isAdmin;
  const isClientAdmin = has("client_admin") || has("client");
  const isClientUser = has("client_user");

  const roleLabel = isSuperAdmin
    ? "Super admin"
    : isAgencyStaff
      ? "Agency staff"
      : isAdmin
        ? "Admin"
        : isClientAdmin
          ? "Client admin"
          : isClientUser
            ? "Client user"
            : "No role";

  return {
    roles,
    loading,
    roleLabel,
    isSuperAdmin,
    isAgencyStaff,
    isAdmin,
    isAgency,
    isClientAdmin,
    isClientUser,
    isClient: isClientAdmin || isClientUser,
    reload,
  };
}
