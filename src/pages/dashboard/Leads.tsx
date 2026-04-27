import { motion } from "framer-motion";
import { Mail, Phone, MessageSquare, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

const mockLeads = [
  { id: 1, name: "Sarah Jenkins", type: "Form Submit", source: "acmeplumbing.com", time: "10 mins ago", msg: "Need a quote for a new water heater installation.", read: false },
  { id: 2, name: "Mike Ross", type: "Call", source: "Google Business Profile", time: "1 hr ago", msg: "Missed call. Voicemail left: \"Hi, I have a leak...\"", read: true },
  { id: 3, name: "Elena Gilbert", type: "Chat", source: "acmeplumbing.com", time: "3 hrs ago", msg: "Are you available this weekend?", read: true },
  { id: 4, name: "David Kim", type: "Form Submit", source: "acmeplumbing.com", time: "1 day ago", msg: "General inquiry about commercial rates.", read: true },
];

export function Leads() {
  const unreadCount = mockLeads.filter((l) => !l.read).length;

  return (
    <DashboardLayout>
      <TopBar
        title="Leads & Interactions"
        subtitle="Real-time alerts from your websites and GBP integrations"
      />

      <div className="p-6 space-y-5">
        {/* Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <button className="text-xs font-bold bg-[#0078D7] text-white px-3 py-1.5 rounded-lg">All</button>
            <button className="text-xs font-bold bg-white/5 border border-white/10 text-[rgba(238,241,250,0.6)] px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
              Unread ({unreadCount})
            </button>
          </div>
          <button className="text-xs text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA] transition-colors">
            Mark all read
          </button>
        </motion.div>

        {/* Leads Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#111E33] rounded-xl border border-white/8 overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {["Contact", "Type", "Message Snapshot", "Time"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-[rgba(238,241,250,0.4)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockLeads.map((lead, i) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className={`border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer ${!lead.read ? "bg-[#0078D7]/5" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {!lead.read && <div className="w-1.5 h-1.5 rounded-full bg-[#0078D7] flex-shrink-0" />}
                      <div>
                        <div className="text-xs font-semibold text-[#EEF1FA]">{lead.name}</div>
                        <div className="text-[10px] text-[rgba(238,241,250,0.4)]">{lead.source}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                      lead.type === "Form Submit" ? "bg-[#0078D7]/15 text-[#0078D7]" :
                      lead.type === "Call" ? "bg-[#22C55E]/15 text-[#22C55E]" :
                      "bg-yellow-400/15 text-yellow-400"
                    }`}>
                      {lead.type === "Form Submit" ? <Mail className="w-3 h-3" /> :
                       lead.type === "Call" ? <Phone className="w-3 h-3" /> :
                       <MessageSquare className="w-3 h-3" />}
                      {lead.type}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 max-w-xs">
                    <p className="text-xs text-[rgba(238,241,250,0.65)] truncate">{lead.msg}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 text-[10px] text-[rgba(238,241,250,0.4)]">
                      <Clock className="w-3 h-3" /> {lead.time}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
