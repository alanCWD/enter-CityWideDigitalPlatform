import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  id: string;
  reviewer_name: string | null;
  rating: number | null;
  comment: string | null;
  reply: string | null;
  review_time: string | null;
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function ReviewsList({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        No reviews synced yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="bg-white/3 rounded-lg p-3 border border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground">{r.reviewer_name}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-3 h-3",
                    i <= (r.rating || 0)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-white/20"
                  )}
                />
              ))}
            </div>
          </div>
          {r.comment && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">{r.comment}</p>
          )}
          {r.reply && (
            <div className="mt-2 pl-2 border-l-2 border-primary/40">
              <p className="text-[10px] text-primary font-semibold mb-0.5">Owner reply:</p>
              <p className="text-[10px] text-muted-foreground">{r.reply}</p>
            </div>
          )}
          <p className="text-[10px] text-[rgba(238,241,250,0.3)] mt-1.5">{formatDate(r.review_time)}</p>
        </div>
      ))}
    </div>
  );
}
