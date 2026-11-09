import { useEffect, useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, UserPlus, AlertCircle, MailCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Logo, LogoOnDark } from "@/components/branding/Logo";

const SUPPORT_EMAIL = "alan@citywidedigital.ca";

export default function Signup() {
  const { signUp, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetEmail = params.get("email") || "";
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && session) {
      navigate("/portal", { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Signup is invitation-only: the agency creates the invite from the dashboard.
    const { data: invited, error: inviteErr } = await supabase.rpc("has_portal_invite", {
      _email: email.trim().toLowerCase(),
    });
    if (inviteErr) {
      setError("We couldn't check your invitation just now. Please try again.");
      setSubmitting(false);
      return;
    }
    if (!invited) {
      setError(
        `We don't have an invitation for ${email}. Ask your CityWide account manager to invite you, or email ${SUPPORT_EMAIL}.`,
      );
      setSubmitting(false);
      return;
    }

    const { error: err } = await signUp(email.trim(), password);
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    // Email confirmation is required, so there is no session yet.
    setConfirmSentTo(email.trim());
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen portal-auth-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center justify-center mb-5" aria-label="CityWide Digital — home">
            <><Logo size="lg" className="dark:hidden" /><LogoOnDark size="lg" className="hidden dark:block" /></>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Use the email your agency invited you with.
          </p>
        </div>

        {confirmSentTo ? (
          <div className="bg-card rounded-2xl border border-border p-6 space-y-3 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <MailCheck className="w-7 h-7 text-primary mx-auto" />
            <h2 className="text-base font-bold text-foreground">Confirm your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <span className="text-foreground font-semibold">{confirmSentTo}</span>.
              Open it to finish setting up your account, then sign in.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Nothing arrived? Check spam, or email {SUPPORT_EMAIL}.
            </p>
            <Link to="/portal/login" className="text-primary text-sm hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              placeholder="At least 6 characters"
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
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Create account
          </button>

          <p className="text-[11px] text-center text-muted-foreground">
            Already have an account?{" "}
            <Link to="/portal/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
        )}
      </div>
    </div>
  );
}
