import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wand2,
  Copy,
  LayoutTemplate,
  Store,
  Bot,
  Zap,
  Globe2,
  FileCode2,
  BookText,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

type CreationMode = "template" | "copy";
type Tier = "basic" | "pro" | "enterprise";

const PROMPT_PRESETS = [
  {
    name: "Agency Blueprint",
    icon: Wand2,
    description: "Master prompt for generating full agency website apps.",
    color: "text-[#0078D7]",
    bg: "bg-[#0078D7]/10",
  },
  {
    name: "GBP Sync Code",
    icon: Store,
    description: "Architect backend sync logic between Google and website.",
    color: "text-[#22C55E]",
    bg: "bg-[#22C55E]/10",
  },
  {
    name: "SEO Master",
    icon: Globe2,
    description: "Perform SEO and AI-readiness overhaul on an existing app.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    name: "Programmatic SEO Machine",
    icon: FileCode2,
    description: "Architect a programmatic SEO framework with dynamic routes and Schema.org injection.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    name: "Retail Merchant Sync",
    icon: ShoppingBag,
    description: "Architect a retail backend that syncs products and local inventory to Google Merchant Center.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
];

const TEMPLATES = [
  { id: "restaurant", icon: "🍽", name: "Restaurant", desc: "Menu sync, orders, native ordering engine" },
  { id: "contractor", icon: "🔧", name: "Contractor", desc: "Services, service area, lead capture" },
  { id: "retail", icon: "🛍", name: "Retail Store", desc: "Product catalog, inventory, Merchant Center" },
];

const TIERS: { id: Tier; name: string; price: string; features: string[] }[] = [
  { id: "basic", name: "Basic", price: "$97/mo", features: ["GMB Sync", "1 Template", "SEO Basics"] },
  { id: "pro", name: "Pro", price: "$197/mo", features: ["Everything in Basic", "Social Sync", "Listing Manager", "Analytics"] },
  { id: "enterprise", name: "Enterprise", price: "$297/mo", features: ["Everything in Pro", "Video Reviews", "POS Integration", "Native Ordering"] },
];

export function Builder() {
  const [mode, setMode] = useState<CreationMode>("template");
  const [tier, setTier] = useState<Tier>("pro");
  const [useGbp, setUseGbp] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("restaurant");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <TopBar
        title="App Builder"
        subtitle="Generate and deploy client website apps from templates or AI prompts"
        action={{ label: "+ Deploy New App" }}
      />

      <div className="p-6 space-y-6">
        {/* Mode Toggle */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          <button
            onClick={() => setMode("template")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
              mode === "template"
                ? "bg-[#0078D7] text-white shadow-[0_2px_8px_rgba(0,120,215,0.3)]"
                : "bg-white/5 border border-white/10 text-[rgba(238,241,250,0.6)] hover:bg-white/10"
            )}
          >
            <LayoutTemplate className="w-4 h-4" /> Template Mode
          </button>
          <button
            onClick={() => setMode("copy")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
              mode === "copy"
                ? "bg-[#0078D7] text-white shadow-[0_2px_8px_rgba(0,120,215,0.3)]"
                : "bg-white/5 border border-white/10 text-[rgba(238,241,250,0.6)] hover:bg-white/10"
            )}
          >
            <Copy className="w-4 h-4" /> Copy Competitor
          </button>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="lg:col-span-2 space-y-5">
            {/* Template Selection */}
            {mode === "template" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
                <h3 className="text-sm font-bold text-[#EEF1FA] mb-4">Select Niche Template</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        selectedTemplate === t.id
                          ? "border-[#0078D7] bg-[#0078D7]/10"
                          : "border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      )}
                    >
                      <div className="text-2xl mb-2">{t.icon}</div>
                      <div className="text-sm font-bold text-[#EEF1FA]">{t.name}</div>
                      <div className="text-[10px] text-[rgba(238,241,250,0.5)] mt-1">{t.desc}</div>
                      {selectedTemplate === t.id && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#0078D7]">
                          <Check className="w-3 h-3" /> Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {mode === "copy" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
                <h3 className="text-sm font-bold text-[#EEF1FA] mb-3">Clone Competitor Website</h3>
                <input
                  type="url"
                  placeholder="https://competitor-restaurant.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.3)] focus:outline-none focus:border-[#0078D7] transition-colors"
                />
                <p className="text-[10px] text-[rgba(238,241,250,0.4)] mt-2">
                  We'll analyze the design, structure, and niche features, then generate a superior version connected to your client's GBP.
                </p>
              </motion.div>
            )}

            {/* GBP Toggle */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
                  <Store className="w-4 h-4 text-[#22C55E]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#EEF1FA]">Connect Google Business Profile</div>
                  <div className="text-[10px] text-[rgba(238,241,250,0.5)]">Auto-sync content, hours, menus, posts, and reviews</div>
                </div>
              </div>
              <button
                onClick={() => setUseGbp(!useGbp)}
                className={cn(
                  "w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0",
                  useGbp ? "bg-[#22C55E]" : "bg-white/20"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                  useGbp ? "translate-x-5" : "translate-x-0.5"
                )} />
              </button>
            </motion.div>

            {/* AI Prompt Presets */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-4 h-4 text-[#0078D7]" />
                <h3 className="text-sm font-bold text-[#EEF1FA]">AI Prompt Presets</h3>
              </div>
              <div className="space-y-2">
                {PROMPT_PRESETS.map((preset) => (
                  <div key={preset.name} className="border border-white/8 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedPrompt(expandedPrompt === preset.name ? null : preset.name)}
                      className="w-full flex items-center justify-between p-3.5 hover:bg-white/3 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", preset.bg)}>
                          <preset.icon className={cn("w-4 h-4", preset.color)} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#EEF1FA]">{preset.name}</div>
                          <div className="text-[10px] text-[rgba(238,241,250,0.5)]">{preset.description}</div>
                        </div>
                      </div>
                      {expandedPrompt === preset.name ? (
                        <ChevronUp className="w-4 h-4 text-[rgba(238,241,250,0.4)] flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[rgba(238,241,250,0.4)] flex-shrink-0" />
                      )}
                    </button>
                    {expandedPrompt === preset.name && (
                      <div className="px-4 pb-4 border-t border-white/8 pt-3">
                        <button className="w-full bg-[#0078D7] hover:bg-[#00447A] text-white text-xs font-bold py-2.5 rounded-lg transition-colors">
                          Use This Prompt Template
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right: Tier Selection */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4">
            <div className="bg-[#111E33] rounded-xl p-5 border border-white/8">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-bold text-[#EEF1FA]">Select Tier</h3>
              </div>
              <div className="space-y-2.5">
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    className={cn(
                      "w-full p-3.5 rounded-xl border text-left transition-all",
                      tier === t.id
                        ? "border-[#0078D7] bg-[#0078D7]/10"
                        : "border-white/8 hover:border-white/20 hover:bg-white/3"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#EEF1FA]">{t.name}</span>
                      <span className="text-xs font-bold text-[#0078D7]">{t.price}</span>
                    </div>
                    <ul className="space-y-1">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-[10px] text-[rgba(238,241,250,0.55)]">
                          <Check className="w-2.5 h-2.5 text-[#22C55E]" /> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            {/* Deploy Button */}
            <button className="w-full bg-[linear-gradient(90deg,#0078D7,#00447A)] hover:opacity-90 text-white text-sm font-bold py-3.5 rounded-xl transition-opacity shadow-[0_4px_16px_rgba(0,120,215,0.3)] flex items-center justify-center gap-2">
              <Wand2 className="w-4 h-4" />
              Generate & Deploy
            </button>
            <p className="text-[10px] text-center text-[rgba(238,241,250,0.3)]">
              Estimated deploy time: 3–5 minutes
            </p>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
