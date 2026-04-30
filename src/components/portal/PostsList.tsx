import { Tag, Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PostItem {
  id: string;
  summary: string | null;
  topic_type: string | null;
  post_time: string | null;
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function PostsList({ posts }: { posts: PostItem[] }) {
  if (posts.length === 0) {
    return (
      <p className="text-xs text-[rgba(238,241,250,0.4)] text-center py-6">
        No posts synced yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <div key={p.id} className="bg-white/3 rounded-lg p-3 border border-white/5">
          <div className="flex items-center gap-1.5 mb-1.5">
            {p.topic_type === "OFFER" ? (
              <Tag className="w-3 h-3 text-[#22C55E]" />
            ) : p.topic_type === "EVENT" ? (
              <Calendar className="w-3 h-3 text-yellow-400" />
            ) : (
              <FileText className="w-3 h-3 text-[#0078D7]" />
            )}
            <span
              className={cn(
                "text-[10px] font-bold",
                p.topic_type === "OFFER"
                  ? "text-[#22C55E]"
                  : p.topic_type === "EVENT"
                    ? "text-yellow-400"
                    : "text-[#0078D7]"
              )}
            >
              {p.topic_type || "POST"}
            </span>
          </div>
          {p.summary && (
            <p className="text-[10px] text-[rgba(238,241,250,0.65)] leading-relaxed">{p.summary}</p>
          )}
          <p className="text-[10px] text-[rgba(238,241,250,0.3)] mt-1.5">{formatDate(p.post_time)}</p>
        </div>
      ))}
    </div>
  );
}
