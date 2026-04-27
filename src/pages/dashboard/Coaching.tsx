import { motion } from "framer-motion";
import { GraduationCap, ExternalLink } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

export function Coaching() {
  return (
    <DashboardLayout>
      <TopBar
        title="GSO Coach"
        subtitle="Google Search Optimization coaching & training module"
        action={{ label: "Open in new tab", href: "https://gso-coach.replit.app/" }}
      />

      <div className="p-6 flex flex-col gap-5 flex-1">
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111E33] rounded-xl p-5 border border-white/8 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0078D7]/15 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#0078D7]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EEF1FA]">Interactive Coaching Session Active</h3>
              <p className="text-xs text-[rgba(238,241,250,0.5)]">Interact with the module directly to improve ranking strategies.</p>
            </div>
          </div>
          <a
            href="https://gso-coach.replit.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-[0_2px_8px_rgba(0,120,215,0.3)]"
          >
            Full Screen <ExternalLink className="w-3 h-3" />
          </a>
        </motion.div>

        {/* Embedded iframe */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 min-h-[600px] bg-[#111E33] rounded-xl border border-white/8 overflow-hidden"
        >
          <iframe
            src="https://gso-coach.replit.app/"
            title="GSO Coach"
            className="w-full h-full min-h-[600px]"
            allow="camera; microphone"
          />
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
