import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Users,
  Trash2,
  Shield,
  Briefcase,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

interface ManagedUser {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: AppRole[];
}

const ROLE_META: Record<AppRole, { icon: typeof Shield; color: string; label: string }> = {
  admin: { icon: Shield, color: "text-[#22C55E] bg-[#22C55E]/15 border-[#22C55E]/30", label: "Admin" },
  agency: { icon: Briefcase, color: "text-[#0078D7] bg-[#0078D7]/15 border-[#0078D7]/30", label: "Agency" },
  client: { icon: UserIcon, color: "text-[#A855F7] bg-[#A855F7]/15 border-[#A855F7]/30", label: "Client" },
};

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function ToastBanner({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-bold border",
        type === "success"
          ? "bg-[#111E33] border-[#22C55E]/30 text-[#22C55E]"
          : "bg-[#111E33] border-red-400/30 text-red-400",
      )}
    >
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

export function AdminUsers() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading, reload: reloadRoles } = useUserRole(user?.id);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [bootstrapAttempted, setBootstrapAttempted] = useState(false);

  const callApi = useCallback(
    async (body: Record<string, unknown>) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    [],
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const data = await callApi({ action: "list" });
    if (data.error) {
      setToast({ msg: data.error, type: "error" });
      setUsers([]);
    } else {
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }, [callApi]);

  // Redirect if not signed in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/portal/login", { replace: true, state: { from: "/admin/users" } });
    }
  }, [authLoading, user, navigate]);

  // Bootstrap admin if none exists, then load
  useEffect(() => {
    if (authLoading || roleLoading || !user) return;
    if (isAdmin) {
      loadUsers();
      return;
    }
    if (bootstrapAttempted) return;
    setBootstrapAttempted(true);
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bootstrap-admin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const data = await res.json();
      if (data.bootstrapped) {
        setToast({ msg: "You are now the system admin", type: "success" });
        await reloadRoles();
      }
    })();
  }, [authLoading, roleLoading, user, isAdmin, bootstrapAttempted, reloadRoles, loadUsers]);

  const toggleRole = async (userId: string, role: AppRole, currentlyHas: boolean) => {
    setBusyUserId(userId);
    const data = await callApi({ action: "setRole", userId, role, enabled: !currentlyHas });
    if (data.error) {
      setToast({ msg: data.error, type: "error" });
    } else {
      setToast({ msg: `${currentlyHas ? "Removed" : "Granted"} ${role} role`, type: "success" });
      await loadUsers();
      if (userId === user?.id) await reloadRoles();
    }
    setBusyUserId(null);
  };

  const deleteUser = async (u: ManagedUser) => {
    if (!window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    setBusyUserId(u.id);
    const data = await callApi({ action: "deleteUser", userId: u.id });
    if (data.error) {
      setToast({ msg: data.error, type: "error" });
    } else {
      setToast({ msg: "User deleted", type: "success" });
      await loadUsers();
    }
    setBusyUserId(null);
  };

  if (authLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-[#0078D7] animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="max-w-md mx-auto bg-[#111E33] rounded-2xl border border-white/8 p-8 text-center">
            <Shield className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#EEF1FA] mb-2">Admins only</h2>
            <p className="text-xs text-[rgba(238,241,250,0.6)] leading-relaxed">
              Your account doesn't have admin privileges. Ask an existing admin to grant you the
              <span className="font-bold text-[#22C55E]"> admin </span>
              role for <span className="text-[#0078D7] font-semibold">{user.email}</span>.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TopBar
        title="User Management"
        subtitle={`${users.length} user${users.length !== 1 ? "s" : ""} · grant or revoke roles`}
        action={{ label: "Refresh", onClick: loadUsers }}
      />
      <div className="p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-[rgba(238,241,250,0.4)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-[#111E33] rounded-2xl border border-white/8 p-12 flex flex-col items-center text-center">
            <Users className="w-8 h-8 text-[#0078D7] mb-3" />
            <h3 className="text-base font-bold text-[#EEF1FA] mb-1">No users found</h3>
            <button
              onClick={loadUsers}
              className="mt-3 flex items-center gap-1.5 text-xs text-[#0078D7] hover:underline"
            >
              <RefreshCw className="w-3 h-3" /> Try again
            </button>
          </div>
        ) : (
          <div className="bg-[#111E33] rounded-2xl border border-white/8 overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/3 border-b border-white/8">
                <tr>
                  <th className="text-left text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider px-4 py-3">
                    User
                  </th>
                  <th className="text-left text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Created
                  </th>
                  <th className="text-left text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                    Last sign-in
                  </th>
                  <th className="text-left text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider px-4 py-3">
                    Roles
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isMe = u.id === user.id;
                  const busy = busyUserId === u.id;
                  return (
                    <tr key={u.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/2">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(u.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#EEF1FA] truncate flex items-center gap-1.5">
                              {u.email}
                              {isMe && (
                                <span className="text-[9px] font-bold bg-[#0078D7]/15 text-[#0078D7] px-1.5 py-0.5 rounded-full">
                                  you
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[rgba(238,241,250,0.55)] hidden md:table-cell">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[rgba(238,241,250,0.55)] hidden md:table-cell">
                        {formatDate(u.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(["admin", "agency", "client"] as AppRole[]).map((role) => {
                            const has = u.roles.includes(role);
                            const meta = ROLE_META[role];
                            return (
                              <button
                                key={role}
                                disabled={busy}
                                onClick={() => toggleRole(u.id, role, has)}
                                className={cn(
                                  "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition-all",
                                  has
                                    ? meta.color
                                    : "text-[rgba(238,241,250,0.35)] border-white/10 bg-white/3 hover:bg-white/5 hover:text-[rgba(238,241,250,0.6)]",
                                  busy && "opacity-50 cursor-not-allowed",
                                )}
                                title={has ? `Click to remove ${meta.label} role` : `Click to grant ${meta.label} role`}
                              >
                                <meta.icon className="w-2.5 h-2.5" />
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={busy || isMe}
                          onClick={() => deleteUser(u)}
                          className={cn(
                            "p-1.5 rounded-lg border transition-colors",
                            isMe
                              ? "bg-white/3 border-white/8 text-[rgba(238,241,250,0.2)] cursor-not-allowed"
                              : "bg-white/5 border-white/10 text-[rgba(238,241,250,0.4)] hover:text-red-400 hover:border-red-400/30",
                          )}
                          title={isMe ? "You can't delete yourself" : "Delete user"}
                        >
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-[rgba(238,241,250,0.35)]">
          Click any role badge to grant or revoke. The system blocks removing the last admin.
        </p>
      </div>

      {toast && <ToastBanner msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
