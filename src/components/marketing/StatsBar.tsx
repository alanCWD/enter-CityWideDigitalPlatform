import { TrendingUp, MapPin, Star, Clock } from "lucide-react";

const stats = [
  { icon: TrendingUp, value: "2,400+", label: "SMBs served" },
  { icon: MapPin, value: "40+", label: "Directories synced" },
  { icon: Star, value: "4.9 / 5", label: "Avg. customer rating" },
  { icon: Clock, value: "100%", label: "Auto-updated content" },
];

export default function StatsBar() {
  return (
    <div className="bg-white border-b border-border">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 divide-y-0 lg:divide-x divide-border">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 pl-0 lg:pl-6 first:lg:pl-0">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold text-secondary leading-none">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
