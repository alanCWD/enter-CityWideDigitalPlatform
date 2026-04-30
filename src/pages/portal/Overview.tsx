import { Star, MessageSquare, FileText, RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import type { PortalConnection } from "@/hooks/usePortalConnections";

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never";

function OverviewContent({ connection }: { connection: PortalConnection }) {
  const cards = [
    { label: "Google Rating", value: connection.rating ? connection.rating.toFixed(1) : "—", suffix: connection.rating ? "/ 5.0" : "", icon: Star, color: "text-yellow-400" },
    { label: "Reviews", value: connection.review_count ?? 0, icon: MessageSquare, color: "text-[#22C55E]" },
    { label: "Last Sync", value: formatDate(connection.last_synced_at), icon: RefreshCw, color: "text-[#0078D7]" },
    { label: "Category", value: connection.category || "—", icon: FileText, color: "text-[#A855F7]" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#EEF1FA]">
          Welcome, {connection.business_name || connection.client_label}
        </h1>
        <p className="text-sm text-[rgba(238,241,250,0.55)] mt-1">
          Your business performance at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#111E33] rounded-xl p-4 border border-white/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[rgba(238,241,250,0.4)] uppercase tracking-wide">
                {c.label}
              </span>
              <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
            </div>
            <div className="text-xl font-bold text-[#EEF1FA]">
              {c.value}
              {c.suffix && (
                <span className="text-xs font-normal text-[rgba(238,241,250,0.4)] ml-1">{c.suffix}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          { to: `/portal/${connection.id}/gbp`, label: "View GBP data", desc: "Reviews, posts, NAP details" },
          { to: `/portal/${connection.id}/social`, label: "Manage socials", desc: "Cross-post to all your channels" },
          { to: `/portal/${connection.id}/coach`, label: "Talk to GSO Coach", desc: "Get AI guidance on growth" },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group bg-[#111E33] hover:bg-[#15243F] rounded-xl p-4 border border-white/8 hover:border-[#0078D7]/40 transition-colors flex items-center justify-between"
          >
            <div>
              <div className="text-sm font-bold text-[#EEF1FA]">{link.label}</div>
              <div className="text-[11px] text-[rgba(238,241,250,0.5)] mt-0.5">{link.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#0078D7] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Overview() {
  return <PortalLayout>{(c) => <OverviewContent connection={c} />}</PortalLayout>;
}
