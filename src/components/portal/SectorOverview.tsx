import { Star, MessageSquare, RefreshCw, FileText, Phone, ShoppingBag, Calendar, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { getSector } from "@/lib/sector";

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never";

interface Props {
  connection: PortalConnection;
}

function StatCard({ label, value, suffix, icon: Icon, color }: {
  label: string; value: string | number; suffix?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <div className="text-xl font-bold text-foreground">
        {value}
        {suffix && <span className="text-xs font-normal text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function QuickLink({ to, label, desc }: { to: string; label: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group bg-card hover:bg-muted/80 rounded-xl p-4 border border-border hover:border-primary/40 transition-colors flex items-center justify-between"
    >
      <div>
        <div className="text-sm font-bold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export function SectorOverview({ connection }: Props) {
  const sector = getSector(connection.category);
  const id = connection.id;

  const baseStats = [
    { label: "Google Rating", value: connection.rating?.toFixed(1) ?? "—", suffix: connection.rating ? "/ 5.0" : "", icon: Star, color: "text-yellow-400" },
    { label: "Reviews", value: connection.review_count ?? 0, icon: MessageSquare, color: "text-[#22C55E]" },
    { label: "Last Sync", value: formatDate(connection.last_synced_at), icon: RefreshCw, color: "text-primary" },
  ];

  if (sector === "restaurant") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {baseStats.map((s) => <StatCard key={s.label} {...s} />)}
          <StatCard label="Category" value="Restaurant" icon={FileText} color="text-[#F59E0B]" />
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Restaurant Priorities</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Star className="w-4 h-4 text-yellow-400 mb-2" />
              <div className="text-xs font-bold text-foreground">Respond to Reviews</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Build trust, boost ranking</div>
            </div>
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Calendar className="w-4 h-4 text-primary mb-2" />
              <div className="text-xs font-bold text-foreground">Post Weekly Specials</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Drive foot traffic via GBP</div>
            </div>
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Phone className="w-4 h-4 text-[#22C55E] mb-2" />
              <div className="text-xs font-bold text-foreground">Keep Hours Updated</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Holiday hours matter most</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <QuickLink to={`/portal/${id}/gbp`} label="GBP Posts" desc="Specials, events, offers" />
          <QuickLink to={`/portal/${id}/social`} label="Social Sync" desc="Cross-post to all channels" />
          <QuickLink to={`/portal/${id}/crm`} label="Customer Leads" desc="Reservations & enquiries" />
        </div>
      </div>
    );
  }

  if (sector === "retail") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {baseStats.map((s) => <StatCard key={s.label} {...s} />)}
          <StatCard label="Category" value="Retail" icon={ShoppingBag} color="text-[#A855F7]" />
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Retail Priorities</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <ShoppingBag className="w-4 h-4 text-[#A855F7] mb-2" />
              <div className="text-xs font-bold text-foreground">Promote Products</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Showcase on GBP + socials</div>
            </div>
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Star className="w-4 h-4 text-yellow-400 mb-2" />
              <div className="text-xs font-bold text-foreground">Collect Reviews</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Post-purchase follow-up</div>
            </div>
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Calendar className="w-4 h-4 text-primary mb-2" />
              <div className="text-xs font-bold text-foreground">Run Seasonal Promos</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Schedule in advance</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <QuickLink to={`/portal/${id}/social`} label="Promotion Scheduler" desc="Plan your next campaign" />
          <QuickLink to={`/portal/${id}/gbp`} label="GBP Listing" desc="Products & hours" />
          <QuickLink to={`/portal/${id}/crm`} label="Customer Leads" desc="Enquiries & follow-ups" />
        </div>
      </div>
    );
  }

  if (sector === "service") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {baseStats.map((s) => <StatCard key={s.label} {...s} />)}
          <StatCard label="Category" value="Service" icon={Phone} color="text-primary" />
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Service Business Priorities</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Phone className="w-4 h-4 text-[#22C55E] mb-2" />
              <div className="text-xs font-bold text-foreground">Track Inbound Leads</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Never miss a booking request</div>
            </div>
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Star className="w-4 h-4 text-yellow-400 mb-2" />
              <div className="text-xs font-bold text-foreground">Request Reviews</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">After every completed job</div>
            </div>
            <div className="bg-muted rounded-lg p-3 border border-border/50">
              <Calendar className="w-4 h-4 text-primary mb-2" />
              <div className="text-xs font-bold text-foreground">Post Before/After Work</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Showcase craftsmanship</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <QuickLink to={`/portal/${id}/crm`} label="Manage Leads" desc="Contacts & follow-up notes" />
          <QuickLink to={`/portal/${id}/social`} label="Post Jobs & Tips" desc="Build authority on socials" />
          <QuickLink to={`/portal/${id}/gbp`} label="GBP Services" desc="Keep offerings up to date" />
        </div>
      </div>
    );
  }

  // Generic fallback
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {baseStats.map((s) => <StatCard key={s.label} {...s} />)}
        <StatCard label="Category" value={connection.category || "—"} icon={FileText} color="text-[#A855F7]" />
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <QuickLink to={`/portal/${id}/gbp`} label="View GBP data" desc="Reviews, posts, NAP details" />
        <QuickLink to={`/portal/${id}/social`} label="Manage socials" desc="Cross-post to all your channels" />
        <QuickLink to={`/portal/${id}/crm`} label="Customer Leads" desc="Contacts & follow-up notes" />
      </div>
    </div>
  );
}
