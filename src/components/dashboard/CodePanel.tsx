import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Copy, Check, ExternalLink, FileCode, Package, Settings } from "lucide-react";
import JSZip from "jszip";
import { cn } from "@/lib/utils";

interface CodePanelProps {
  files: Record<string, string>;
  clientName: string;
  blueprint: string;
}

// Sort files: config first, then src
function sortFiles(files: Record<string, string>): string[] {
  const keys = Object.keys(files);
  const order = ["package.json", "index.html", "vite.config.ts", "tailwind.config.ts", "tsconfig.json", "tsconfig.node.json", "postcss.config.js"];
  const configs = order.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !order.includes(k)).sort();
  return [...configs, ...rest];
}

function fileIcon(path: string) {
  if (path === "package.json" || path.endsWith(".json")) return <Package className="w-3 h-3" />;
  if (path.endsWith("config.ts") || path.endsWith("config.js")) return <Settings className="w-3 h-3" />;
  return <FileCode className="w-3 h-3" />;
}

function fileLabel(path: string) {
  return path.split("/").pop() || path;
}

export function CodePanel({ files, clientName, blueprint }: CodePanelProps) {
  const sortedKeys = sortFiles(files);
  const [activeFile, setActiveFile] = useState(sortedKeys[0] || "");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [enterCopied, setEnterCopied] = useState(false);

  const handleCopyFile = async () => {
    await navigator.clipboard.writeText(files[activeFile] || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "website";
      const folder = zip.folder(slug)!;

      for (const [path, content] of Object.entries(files)) {
        // Recreate directory structure
        const parts = path.split("/");
        if (parts.length === 1) {
          folder.file(path, content);
        } else {
          let current = folder;
          for (let i = 0; i < parts.length - 1; i++) {
            current = current.folder(parts[i])!;
          }
          current.file(parts[parts.length - 1], content);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-site.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenInEnter = async () => {
    const prompt = `Build this website:\n\nBusiness: ${clientName}\n\n${blueprint.slice(0, 3000)}`;
    await navigator.clipboard.writeText(prompt);
    setEnterCopied(true);
    setTimeout(() => setEnterCopied(false), 3000);
    window.open("https://enter.pro", "_blank");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card dark:bg-[#111E33] rounded-xl border border-border dark:border-white/8 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border dark:border-white/8 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#22C55E]" />
          <span className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">Generated Code</span>
          <span className="text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-2 py-0.5 rounded-full">
            {sortedKeys.length} files
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyFile}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground dark:text-[#EEF1FA] transition-colors bg-muted/60 dark:bg-white/5 border border-border dark:border-white/10 px-2.5 py-1.5 rounded-lg"
          >
            {copied ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy File"}
          </button>
          <button
            onClick={handleDownloadZip}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0078D7] hover:bg-[#00447A] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            <Download className="w-3 h-3" />
            {downloading ? "Zipping..." : "Download ZIP"}
          </button>
          <button
            onClick={handleOpenInEnter}
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all",
              enterCopied
                ? "bg-[#22C55E]/15 border-[#22C55E]/30 text-[#22C55E]"
                : "bg-muted/60 dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground hover:text-foreground dark:text-[#EEF1FA]"
            )}
          >
            <ExternalLink className="w-3 h-3" />
            {enterCopied ? "Copied! Opening..." : "Open in Enter"}
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border dark:border-white/8 overflow-x-auto scrollbar-thin">
        {sortedKeys.map((key) => (
          <button
            key={key}
            onClick={() => setActiveFile(key)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex-shrink-0",
              activeFile === key
                ? "bg-[#0078D7]/20 text-[#0078D7] border border-[#0078D7]/30"
                : "text-muted-foreground hover:text-foreground dark:text-[#EEF1FA] hover:bg-muted/60 dark:bg-white/5"
            )}
          >
            {fileIcon(key)}
            {fileLabel(key)}
          </button>
        ))}
      </div>

      {/* Active File Path */}
      <div className="px-5 py-2 bg-muted/20 dark:bg-white/2 border-b border-border dark:border-white/5">
        <span className="text-[10px] font-mono text-muted-foreground">{activeFile}</span>
      </div>

      {/* Code Viewer */}
      <div className="relative">
        <pre className="p-5 max-h-[480px] overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre bg-transparent scroll-smooth">
          {files[activeFile] || ""}
        </pre>
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-border dark:border-white/8 bg-muted/20 dark:bg-white/2 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Download the ZIP, unzip it, run <span className="font-mono text-[#0078D7]">pnpm install && pnpm dev</span> to preview locally.
        </p>
        <p className="text-[10px] text-muted-foreground">
          Or click <strong className="text-muted-foreground">Open in Enter</strong> to edit in a new project.
        </p>
      </div>
    </motion.div>
  );
}
