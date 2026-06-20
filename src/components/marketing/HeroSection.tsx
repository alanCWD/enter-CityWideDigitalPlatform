import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NetworkBackground from "@/components/marketing/NetworkBackground";

const trustPoints = [
  "No manual updates ever",
  "Live in under 48 hours",
  "30-day free trial",
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0F1A33_0%,#1B2A4A_55%,#00447A_100%)] -mt-[88px] pt-[108px] pb-24 md:pt-[136px] md:pb-32">
      {/* Scroll-driven network animation — extends up under the translucent navbar */}
      <NetworkBackground />

      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#0078D7]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#00447A]/20 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative max-w-[1200px] mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          <Badge variant="on-dark" className="mb-6 text-xs font-semibold tracking-wider uppercase">
            Powered by Google Business Profile
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold text-[#EEF1FA] leading-[1.15] tracking-tight mb-6 text-balance">
            Your Business Runs{" "}
            <span className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#0078D7,#5BB8FF)]">
              Itself Online
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[rgba(238,241,250,0.75)] leading-relaxed mb-8 max-w-2xl mx-auto text-balance">
            CityWide Digital connects your Google Business Profile to a live website, 
            all your social channels, and every major directory —{" "}
            <span className="text-[#EEF1FA] font-medium">automatically</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Button variant="on-dark" size="xl" asChild>
              <Link to="/pricing">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="ghost-dark" size="xl" asChild>
              <a href="https://meet.google.com/hde-tjen-maf" target="_blank" rel="noopener noreferrer">
                <Calendar className="w-4 h-4" />
                Book a Demo
              </a>
            </Button>
          </div>

          {/* Trust Points */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                <span className="text-sm text-[rgba(238,241,250,0.65)]">{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Image / Dashboard Mockup */}
        <div className="relative mt-16 max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.5)]">
            <div className="bg-[#0A1628] h-8 flex items-center px-4 gap-1.5 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <div className="ml-4 flex-1 bg-white/5 rounded h-4 max-w-xs" />
            </div>
            <div className="bg-[#0F1F3D] p-8 grid grid-cols-3 gap-4 min-h-[280px]">
              <div className="col-span-2 space-y-3">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xs text-[#0078D7] font-semibold mb-2 uppercase tracking-wider">Live Website</div>
                  <div className="h-3 bg-white/20 rounded mb-1.5 w-3/4" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-xs text-[rgba(238,241,250,0.5)] mb-1">Social Channels</div>
                    <div className="text-lg font-bold text-[#EEF1FA]">4</div>
                    <div className="text-xs text-[#22C55E]">All synced</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-xs text-[rgba(238,241,250,0.5)] mb-1">Directories</div>
                    <div className="text-lg font-bold text-[#EEF1FA]">40+</div>
                    <div className="text-xs text-[#22C55E]">Accurate</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-[#0078D7]/20 rounded-xl p-3 border border-[#0078D7]/30">
                  <div className="text-xs text-[#EEF1FA]/70 mb-1">GMB Post</div>
                  <div className="h-2 bg-white/20 rounded mb-1 w-full" />
                  <div className="h-2 bg-white/10 rounded w-2/3" />
                  <div className="mt-2 text-xs text-[#22C55E]">Published everywhere</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-xs text-[rgba(238,241,250,0.5)] mb-1">Reviews</div>
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="w-3 h-3 rounded-sm bg-yellow-400/80" />
                    ))}
                  </div>
                  <div className="text-xs text-[#EEF1FA]/50">4.9 avg · 127 reviews</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
