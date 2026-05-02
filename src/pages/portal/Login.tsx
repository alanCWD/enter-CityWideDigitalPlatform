import { useEffect, useState, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { LogoOnDark } from "@/components/branding/Logo";

export default function Login() {
  const { signIn, session, user, loading: authLoading } = useAuth();
  const { isAdmin, isAgency, loading: roleLoading } = useUserRole(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || roleLoading || !session) return;
    const from = (location.state as { from?: string } | null)?.from;
    // Honor explicit redirect target first
    if (from && (from.startsWith("/portal/") || from.startsWith("/admin/") || from.startsWith("/dashboard"))) {
      navigate(from, { replace: true });
      return;
    }
    // Role-based default landing
    if (isAdmin || isAgency) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/portal", { replace: true });
    }
  }, [session, authLoading, roleLoading, isAdmin, isAgency, navigate, location.state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    // onAuthStateChange will trigger the effect above
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_55%,#00447A_100%)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center justify-center mb-5" aria-label="CityWide Digital — home">
            <LogoOnDark size="lg" />
          </Link>
          <h1 className="text-2xl font-bold text-[#EEF1FA]">Client Portal</h1>
          <p className="text-sm text-[rgba(238,241,250,0.55)] mt-1">Sign in to your business workspace</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#111E33] rounded-2xl border border-white/8 p-6 space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        >
          <div>
            <label className="text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#EEF1FA] focus:outline-none focus:border-[#0078D7]"
              placeholder="you@yourbusiness.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#EEF1FA] focus:outline-none focus:border-[#0078D7]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-[#0078D7] hover:bg-[#0088EE] disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign in
          </button>

          <p className="text-[11px] text-center text-[rgba(238,241,250,0.5)]">
            Need an account?{" "}
            <Link to="/portal/signup" className="text-[#0078D7] hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
