import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  StopCircle,
  Trash2,
  Loader2,
  User,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useKimiChat } from "@/hooks/useKimiChat";

const DEFAULT_MODEL = "kimi-k2-0905-preview";

export function KimiConsole() {
  const { messages, isGenerating, error, send, stop, clear } = useKimiChat();
  const [input, setInput] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    send(trimmed, { model: model.trim() || DEFAULT_MODEL });
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const isEmpty = messages.length === 0;

  return (
    <DashboardLayout>
      <TopBar
        title="Kimi AI"
        subtitle="直连 Moonshot 官方端点的长上下文聊天控制台"
      />

      <div className="p-6 space-y-5">
        {/* Banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0078D7]/8 border border-[#0078D7]/20 rounded-xl p-4 flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-[#0078D7]/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#0078D7]" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">
              使用你自己的 Moonshot 官方 Kimi API Key
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              直连官方端点（api.moonshot.ai），不经过内置 AI 网关计费。请在后端密钥中配置{" "}
              <code className="px-1 py-0.5 rounded bg-muted/60 dark:bg-white/10 text-[10px]">
                KIMI_API_KEY
              </code>
              。
            </p>
          </div>
        </motion.div>

        {/* Model + controls */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card dark:bg-[#111E33] rounded-xl p-4 border border-border dark:border-white/8 flex flex-wrap items-center gap-3"
        >
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Bot className="w-4 h-4 text-[#0078D7] flex-shrink-0" />
            <label className="text-xs font-bold text-foreground dark:text-[#EEF1FA] whitespace-nowrap">
              模型
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
              className="flex-1 bg-muted/60 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-3 py-2 text-xs text-foreground dark:text-[#EEF1FA] placeholder:text-muted-foreground focus:outline-none focus:border-[#0078D7] transition-colors"
            />
          </div>
          <button
            onClick={clear}
            disabled={isEmpty || isGenerating}
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors border",
              isEmpty || isGenerating
                ? "bg-muted/60 dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground cursor-not-allowed"
                : "bg-muted/60 dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground hover:text-foreground dark:hover:text-[#EEF1FA]",
            )}
          >
            <Trash2 className="w-3.5 h-3.5" /> 清空对话
          </button>
        </motion.div>

        {/* Chat window */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card dark:bg-[#111E33] rounded-xl border border-border dark:border-white/8 overflow-hidden flex flex-col h-[70vh] min-h-[440px] max-h-[760px]"
        >
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth"
          >
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#0078D7]/12 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-[#0078D7]" />
                </div>
                <div className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">
                  开始与 Kimi 对话
                </div>
                <p className="text-xs text-muted-foreground max-w-sm">
                  支持长上下文输入。在下方输入消息，模型将逐字流式返回。
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  role={m.role}
                  content={m.content}
                  isStreaming={
                    isGenerating &&
                    i === messages.length - 1 &&
                    m.role === "assistant"
                  }
                />
              ))
            )}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-5 pb-3"
              >
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="break-words">{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="border-t border-border dark:border-white/8 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
                className="flex-1 bg-muted/60 dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-foreground dark:text-[#EEF1FA] placeholder:text-muted-foreground focus:outline-none focus:border-[#0078D7] transition-colors resize-none max-h-[200px]"
              />
              {isGenerating ? (
                <button
                  onClick={stop}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors flex-shrink-0"
                >
                  <StopCircle className="w-4 h-4" /> 停止
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-lg transition-all flex-shrink-0",
                    !input.trim()
                      ? "bg-muted dark:bg-white/10 text-muted-foreground cursor-not-allowed"
                      : "bg-[linear-gradient(90deg,#0078D7,#00447A)] text-white hover:opacity-90 shadow-[0_4px_12px_rgba(0,120,215,0.3)]",
                  )}
                >
                  <Send className="w-4 h-4" /> 发送
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function MessageBubble({
  role,
  content,
  isStreaming,
}: {
  role: string;
  content: string;
  isStreaming: boolean;
}) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isUser ? "bg-[#0078D7]/15" : "bg-[#22C55E]/15",
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-[#0078D7]" />
        ) : (
          <Bot className="w-4 h-4 text-[#22C55E]" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
          isUser
            ? "bg-[#0078D7] text-white"
            : "bg-muted/60 dark:bg-white/5 border border-border dark:border-white/8 text-foreground dark:text-[#EEF1FA]",
        )}
      >
        {isStreaming && !content ? (
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Loader2 className="w-3 h-3 animate-spin" /> 正在思考...
          </span>
        ) : (
          <>
            {content}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-[#0078D7] rounded-sm animate-pulse ml-0.5 align-text-bottom" />
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
