import { useEffect, useState, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo, LogoOnDark } from "@/components/branding/Logo";

/** A browser-level fetch failure ("Failed to fetch", "Load failed") is never the
 *  user's credentials — it means the request never got an answer. Say so plainly
 *  instead of showing the raw browser message. */
function friendlyAuthError(message: string): string {
  if (/failed to fetch|load failed|networkerror|network error|fetch failed/i.test(message)) {
    return "We couldn't reach the server. Check your connection and try again in a moment.";
  }
  return message;
}

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
    try {
      const { error: err } = await signIn(email, password);
      if (err) setError(friendlyAuthError(err.message));
      // On success, onAuthStateChange triggers the redirect effect above.
    } catch (e2) {
      // Transport failures can throw instead of returning an error.
      setError(friendlyAuthError((e2 as Error).message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen portal-auth-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center justify-center mb-5" aria-label="CityWide Digital — home">
            <><Logo size="lg" className="dark:hidden" /><LogoOnDark size="lg" className="hidden dark:block" /></>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Client Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your business workspace</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
        >
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              placeholder="you@yourbusiness.com"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
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
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign in
          </button>

          <p className="text-[11px] text-center text-muted-foreground">
            Need an account?{" "}
            <Link to="/portal/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
