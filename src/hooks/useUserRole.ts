import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "agency" | "client";

/**
 * Loads the signed-in user's roles from `user_roles`.
 * Returns role flags + a refresh helper.
 *
 * SECURITY: All real authorization MUST be done server-side via RLS using the
 * `is_admin()` / `has_role()` security-definer functions. This hook is for UI
 * gating only.
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
    isAdmin: roles.includes("admin"),
    isAgency: roles.includes("agency") || roles.includes("admin"),
    isClient: roles.includes("client"),
    reload,
  };
}
