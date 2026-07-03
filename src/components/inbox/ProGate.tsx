import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface ProGateProps {
  feature: string;
  description: string;
  children: ReactNode;
}

export function ProGate({ feature, description, children }: ProGateProps) {
  return (
    <div className="relative min-h-[400px] flex flex-col">
      {/* Blurred background preview */}
      <div className="opacity-20 pointer-events-none select-none flex-1 overflow-hidden">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 backdrop-blur-[2px] bg-background/70 rounded-lg">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs px-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Crown className="w-7 h-7 text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{feature}</span>
            <Badge className="bg-primary/15 text-primary border-primary/25 text-[10px] font-bold px-1.5">
              PRO
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          <Button asChild size="sm" className="mt-1 gap-1.5">
            <Link to="/dashboard/crm/catalog">
              <Lock className="w-3.5 h-3.5" />
              Upgrade to Pro
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
