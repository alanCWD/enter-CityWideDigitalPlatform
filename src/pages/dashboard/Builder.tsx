import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Copy,
  LayoutTemplate,
  Store,
  Bot,
  Zap,
  Globe2,
  FileCode2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  StopCircle,
  ClipboardCopy,
  RotateCcw,
  Sparkles,
  User,
  Code2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { CodePanel } from "@/components/dashboard/CodePanel";
import { useAppBuilderAI } from "@/hooks/useAppBuilderAI";
import { useCodeGen } from "@/hooks/useCodeGen";

type CreationMode = "template" | "copy";
type Tier = "basic" | "pro" | "enterprise";

const PROMPT_PRESETS = [
  { name: "Agency Blueprint", icon: Wand2, description: "Master prompt for generating full agency website apps.", color: "text-[#0078D7]", bg: "bg-[#0078D7]/10" },
  { name: "GBP Sync Code", icon: Store, description: "Architect backend sync logic between Google and website.", color: "text-[#22C55E]", bg: "bg-[#22C55E]/10" },
  { name: "SEO Master", icon: Globe2, description: "Perform SEO and AI-readiness overhaul on an existing app.", color: "text-purple-400", bg: "bg-purple-400/10" },
  { name: "Programmatic SEO Machine", icon: FileCode2, description: "Architect a programmatic SEO framework with dynamic routes and Schema.org injection.", color: "text-orange-400", bg: "bg-orange-400/10" },
  { name: "Retail Merchant Sync", icon: ShoppingBag, description: "Architect a retail backend that syncs products and local inventory to Google Merchant Center.", color: "text-pink-400", bg: "bg-pink-400/10" },
];

const TEMPLATES = [
  { id: "restaurant", label: "Restaurant", icon: "🍽", desc: "Menu sync, orders, native ordering engine" },
  { id: "contractor", label: "Contractor", icon: "🔧", desc: "Services, service area, lead capture" },
  { id: "retail", label: "Retail Store", icon: "🛍", desc: "Product catalog, inventory, Merchant Center" },
];

const TIERS: { id: Tier; name: string; price: string; features: string[] }[] = [
  { id: "basic", name: "Basic", price: "$97/mo", features: ["GMB Sync", "1 Template", "SEO Basics"] },
  { id: "pro", name: "Pro", price: "$197/mo", features: ["Everything in Basic", "Social Sync", "Listing Manager", "Analytics"] },
  { id: "enterprise", name: "Enterprise", price: "$297/mo", features: ["Everything in Pro", "Video Reviews", "POS Integration", "Native Ordering"] },
];

function OutputPanel({
  output,
  isGenerating,
  error,
  isDone,
  onCancel,
  onReset,
}: {
  output: string;
  isGenerating: boolean;
  error: string | null;
  isDone: boolean;
  onCancel: () => void;
  onReset: () => void;
}) {
  const outputRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll as content streams in
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111E33] rounded-xl p-5 border border-red-500/30">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-red-400">Generation Failed</span>
          <button onClick={onReset} className="flex items-center gap-1.5 text-xs text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
        <p className="text-xs text-[rgba(238,241,250,0.7)]">{error}</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111E33] rounded-xl border border-white/8 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className={cn("w-4 h-4", isGenerating ? "text-[#0078D7] animate-pulse" : "text-[#22C55E]")} />
          <span className="text-sm font-bold text-[#EEF1FA]">
            {isGenerating ? "Generating App Specification..." : isDone ? "App Spec Ready" : "Output"}
          </span>
          {isGenerating && (
            <span className="text-[10px] font-bold bg-[#0078D7]/15 text-[#0078D7] px-2 py-0.5 rounded-full animate-pulse">
              Claude Sonnet 4.5
            </span>
          )}
          {isDone && (
            <span className="text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-2 py-0.5 rounded-full">
              Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDone && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-bold text-[rgba(238,241,250,0.6)] hover:text-[#EEF1FA] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          {isGenerating && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              <StopCircle className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          {isDone && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-bold text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Streaming Output */}
      <div
        ref={outputRef}
        className="p-5 max-h-[520px] overflow-y-auto font-mono text-xs leading-relaxed text-[rgba(238,241,250,0.85)] whitespace-pre-wrap scroll-smooth"
      >
        {output}
        {isGenerating && (
          <span className="inline-block w-1.5 h-4 bg-[#0078D7] rounded-sm animate-pulse ml-0.5 align-text-bottom" />
        )}
        {!output && isGenerating && (
          <div className="flex items-center gap-2 text-[rgba(238,241,250,0.4)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Claude is analyzing your configuration...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function Builder() {
  const [mode, setMode] = useState<CreationMode>("template");
  const [tier, setTier] = useState<Tier>("pro");
  const [useGbp, setUseGbp] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState("restaurant");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [clientName, setClientName] = useState("");

  const { output, isGenerating, error, isDone, generate, cancel, reset } = useAppBuilderAI();
  const { files, isGenerating: isGeneratingCode, error: codeError, progress: codeProgress, generateCode, resetCode } = useCodeGen();

  const showOutput = isGenerating || isDone || !!error;
  const showStep2 = isDone && !isGenerating;
  const showCodePanel = !!files;

  const handleGenerateCode = () => {
    generateCode({
      blueprint: output,
      niche: mode === "copy" ? "Business" : (nicheMap[selectedTemplate] ?? "Restaurant"),
      tier,
      clientName,
      template: selectedTemplate,
    });
  };

  // Reset code when blueprint is reset
  const handleReset = () => {
    reset();
    resetCode();
  };

  const nicheMap: Record<string, string> = {
    restaurant: "Restaurant",
    contractor: "Contractor / Home Services",
    retail: "Retail Store",
  };

  const handleGenerate = () => {
    generate({
      niche: mode === "copy" ? "Business" : (nicheMap[selectedTemplate] ?? "Restaurant"),
      tier,
      mode,
      gbp: useGbp,
      preset: activePreset,
      competitorUrl,
      customPrompt,
      clientName,
    });
  };

  return (
    <DashboardLayout>
      <TopBar
        title="App Builder"
        subtitle="Generate and deploy client website apps from templates or AI prompts"
      />

      <div className="p-6 space-y-6">
        {/* Mode Toggle */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          {(["template", "copy"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                mode === m
                  ? "bg-[#0078D7] text-white shadow-[0_2px_8px_rgba(0,120,215,0.3)]"
                  : "bg-white/5 border border-white/10 text-[rgba(238,241,250,0.6)] hover:bg-white/10"
              )}
            >
              {m === "template" ? <LayoutTemplate className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {m === "template" ? "Template Mode" : "Copy Competitor"}
            </button>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="lg:col-span-2 space-y-5">
            {/* Client Name */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-[rgba(238,241,250,0.5)]" />
                <h3 className="text-sm font-bold text-[#EEF1FA]">Client Name</h3>
              </div>
              <input
                type="text"
                placeholder="e.g. Luigi's NY Pizza"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.3)] focus:outline-none focus:border-[#0078D7] transition-colors"
              />
            </motion.div>

            {/* Template / Competitor */}
            <AnimatePresence mode="wait">
              {mode === "template" ? (
                <motion.div key="template" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
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
                        <div className="text-sm font-bold text-[#EEF1FA]">{t.label}</div>
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
              ) : (
                <motion.div key="copy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
                  <h3 className="text-sm font-bold text-[#EEF1FA] mb-3">Clone Competitor Website</h3>
                  <input
                    type="url"
                    placeholder="https://competitor-restaurant.com"
                    value={competitorUrl}
                    onChange={(e) => setCompetitorUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.3)] focus:outline-none focus:border-[#0078D7] transition-colors"
                  />
                  <p className="text-[10px] text-[rgba(238,241,250,0.4)] mt-2">
                    We'll analyze the design, structure, and niche features, then generate a superior version connected to your client's GBP.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* GBP Toggle */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8 flex items-center justify-between">
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
                className={cn("w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0", useGbp ? "bg-[#22C55E]" : "bg-white/20")}
              >
                <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200", useGbp ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </motion.div>

            {/* AI Prompt Presets */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#0078D7]" />
                  <h3 className="text-sm font-bold text-[#EEF1FA]">AI Prompt Presets</h3>
                </div>
                {activePreset && (
                  <button onClick={() => setActivePreset(null)} className="text-[10px] text-[rgba(238,241,250,0.4)] hover:text-[#EEF1FA] transition-colors">
                    Clear preset
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {PROMPT_PRESETS.map((preset) => {
                  const isActive = activePreset === preset.name;
                  return (
                    <div key={preset.name} className={cn("border rounded-xl overflow-hidden transition-all", isActive ? "border-[#0078D7]/40" : "border-white/8")}>
                      <button
                        onClick={() => setExpandedPrompt(expandedPrompt === preset.name ? null : preset.name)}
                        className="w-full flex items-center justify-between p-3.5 hover:bg-white/3 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", preset.bg)}>
                            <preset.icon className={cn("w-4 h-4", preset.color)} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#EEF1FA]">{preset.name}</span>
                              {isActive && <span className="text-[9px] font-bold bg-[#0078D7] text-white px-1.5 py-0.5 rounded">Active</span>}
                            </div>
                            <div className="text-[10px] text-[rgba(238,241,250,0.5)]">{preset.description}</div>
                          </div>
                        </div>
                        {expandedPrompt === preset.name
                          ? <ChevronUp className="w-4 h-4 text-[rgba(238,241,250,0.4)] flex-shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-[rgba(238,241,250,0.4)] flex-shrink-0" />
                        }
                      </button>
                      {expandedPrompt === preset.name && (
                        <div className="px-4 pb-4 border-t border-white/8 pt-3">
                          <button
                            onClick={() => { setActivePreset(preset.name); setExpandedPrompt(null); }}
                            className={cn(
                              "w-full text-xs font-bold py-2.5 rounded-lg transition-colors",
                              isActive
                                ? "bg-white/5 border border-white/10 text-[rgba(238,241,250,0.5)]"
                                : "bg-[#0078D7] hover:bg-[#00447A] text-white"
                            )}
                          >
                            {isActive ? "Already Active" : "Use This Preset"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Custom Prompt */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
              <h3 className="text-sm font-bold text-[#EEF1FA] mb-3">Additional Instructions <span className="text-[10px] font-normal text-[rgba(238,241,250,0.4)]">(optional)</span></h3>
              <textarea
                rows={3}
                placeholder="Any special requirements, brand voice notes, competitor context, or specific features to include..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.3)] focus:outline-none focus:border-[#0078D7] transition-colors resize-none"
              />
            </motion.div>
          </div>

          {/* Right: Tier + Generate */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
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
                      tier === t.id ? "border-[#0078D7] bg-[#0078D7]/10" : "border-white/8 hover:border-white/20 hover:bg-white/3"
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

            {/* AI Config Summary */}
            {activePreset && (
              <div className="bg-[#0078D7]/8 border border-[#0078D7]/20 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#0078D7]" />
                  <span className="text-[10px] font-bold text-[#0078D7] uppercase tracking-wide">Active Preset</span>
                </div>
                <span className="text-xs text-[#EEF1FA]">{activePreset}</span>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={cn(
                "w-full text-white text-sm font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2",
                isGenerating
                  ? "bg-white/10 border border-white/10 cursor-not-allowed"
                  : "bg-[linear-gradient(90deg,#0078D7,#00447A)] hover:opacity-90 shadow-[0_4px_16px_rgba(0,120,215,0.3)]"
              )}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Wand2 className="w-4 h-4" /> Generate & Deploy</>
              )}
            </button>
            <p className="text-[10px] text-center text-[rgba(238,241,250,0.3)]">
              Powered by Claude Sonnet 4.5
            </p>
          </motion.div>
        </div>

        {/* AI Output Panel */}
        <AnimatePresence>
          {showOutput && (
            <OutputPanel
              output={output}
              isGenerating={isGenerating}
              error={error}
              isDone={isDone}
              onCancel={cancel}
              onReset={handleReset}
            />
          )}
        </AnimatePresence>

        {/* Step 2: Generate Code */}
        <AnimatePresence>
          {showStep2 && !showCodePanel && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-[#111E33] rounded-xl border border-[#0078D7]/25 p-5 flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0078D7]/15 flex items-center justify-center flex-shrink-0">
                  <Code2 className="w-5 h-5 text-[#0078D7]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-[#EEF1FA]">Blueprint Ready</span>
                    <span className="text-[9px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-1.5 py-0.5 rounded-full">Step 2</span>
                  </div>
                  <p className="text-xs text-[rgba(238,241,250,0.5)]">
                    Convert this spec into real, downloadable React code for {clientName || "your client"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {codeError && (
                  <span className="text-xs text-red-400">{codeError}</span>
                )}
                <button
                  onClick={handleGenerateCode}
                  disabled={isGeneratingCode}
                  className={cn(
                    "flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all",
                    isGeneratingCode
                      ? "bg-white/10 text-[rgba(238,241,250,0.4)] cursor-not-allowed"
                      : "bg-[linear-gradient(90deg,#0078D7,#00447A)] text-white hover:opacity-90 shadow-[0_4px_12px_rgba(0,120,215,0.3)]"
                  )}
                >
                  {isGeneratingCode
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Building... {codeProgress > 0 && <span className="text-[10px] opacity-70">({(codeProgress / 1024).toFixed(1)}KB)</span>}</>
                    : <><Code2 className="w-4 h-4" /> Generate Code Files <ArrowRight className="w-3.5 h-3.5" /></>
                  }
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Code Panel */}
        <AnimatePresence>
          {showCodePanel && files && (
            <CodePanel files={files} clientName={clientName || "website"} blueprint={output} />
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
