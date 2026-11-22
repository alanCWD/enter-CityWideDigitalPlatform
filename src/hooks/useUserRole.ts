import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "agency" | "client" | "super_admin";

/**
 * Loads the signed-in user's roles from `user_roles`.
 * Returns role flags + a refresh helper.
 *
 * SECURITY: All real authorization is server-side (RLS and the CRM gateway
 * reading `user_roles`). This hook is for UI gating only.
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

  return {
    roles,
    loading,
    /** Agency-level super admin: every client, including other agencies'. */
    isSuperAdmin: roles.includes("super_admin"),
    isAdmin: roles.includes("admin"),
    isAgency:
      roles.includes("agency") || roles.includes("admin") || roles.includes("super_admin"),
    isClient: roles.includes("client"),
    reload,
  };
}
