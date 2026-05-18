import { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, UserPlus, Copy, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

interface InviteClientDialogProps {
  connectionId: string;
  businessName: string;
  onClose: () => void;
}

export function InviteClientDialog({ connectionId, businessName, onClose }: InviteClientDialogProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      setError("Please enter the client's email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/portal-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ email: email.trim(), connectionId }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteUrl(data.inviteUrl);
      } else {
        setError(data.error || "Failed to create invite.");
      }
    } catch (e) {
      setError((e as Error).message || "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-card dark:bg-[#111E33] rounded-2xl border border-border dark:border-white/10 p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground dark:text-[#EEF1FA] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#22C55E]/15 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-[#22C55E]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">Invite client to portal</h3>
            <p className="text-[10px] text-muted-foreground">{businessName}</p>
          </div>
        </div>

        {!inviteUrl ? (
          <>
            <label className="block text-xs font-bold text-muted-foreground mb-2">
              Client email
            </label>
            <input
              type="email"
              placeholder="owner@theirbusiness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="w-full bg-muted/60 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground dark:text-[#EEF1FA] placeholder:text-muted-foreground focus:outline-none focus:border-[#22C55E] transition-colors mb-1"
            />
            {error && (
              <div className="flex items-start gap-2 mt-2 mb-2">
                <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-red-400">{error}</p>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2 mb-4 leading-relaxed">
              When they sign up at the portal with this email, they'll automatically see{" "}
              <strong className="text-foreground dark:text-[#EEF1FA]">{businessName}</strong>'s data.
            </p>
            <button
              onClick={handleInvite}
              disabled={loading}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                loading
                  ? "bg-muted dark:bg-white/10 text-muted-foreground cursor-not-allowed"
                  : "bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-[0_4px_12px_rgba(34,197,94,0.3)]",
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating invite...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create invite link
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg p-3 mb-4">
              <p className="text-xs font-bold text-[#22C55E] mb-1">Invite ready</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Share this link with <strong className="text-foreground dark:text-[#EEF1FA]">{email}</strong>. They'll
                create a password and land in their portal.
              </p>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input
                readOnly
                value={inviteUrl}
                className="flex-1 bg-muted/60 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-3 py-2 text-[10px] text-foreground dark:text-[#EEF1FA] font-mono"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] text-white text-[10px] font-bold px-3 py-2 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-muted/60 dark:bg-white/5 hover:bg-muted dark:bg-white/10 border border-border dark:border-white/10 text-foreground dark:text-[#EEF1FA] text-sm font-bold py-2.5 rounded-xl transition-colors"
            >
              Done
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
