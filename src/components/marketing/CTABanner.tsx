import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CTABanner() {
  return (
    <section className="py-20 md:py-24 bg-[linear-gradient(90deg,#00447A_0%,#0078D7_100%)] relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative max-w-[1200px] mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4 text-balance">
          Ready to run your business online — on autopilot?
        </h2>
        <p className="text-lg text-[rgba(255,255,255,0.8)] mb-10 max-w-xl mx-auto">
          Start your free 30-day trial today. No credit card required.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="default"
            size="xl"
            className="bg-white text-[#00447A] hover:bg-[#F0F5FF] shadow-[0_4px_20px_rgba(0,0,0,0.2)] font-bold"
            asChild
          >
            <Link to="/pricing">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
          <Button
            variant="ghost-dark"
            size="xl"
            className="border-white/40 text-white hover:bg-white/10"
            asChild
          >
            <a href="https://meet.google.com/hde-tjen-maf" target="_blank" rel="noopener noreferrer">
              <Calendar className="w-5 h-5" />
              Book a Demo Call
            </a>
          </Button>
        </div>

        <p className="mt-6 text-sm text-[rgba(255,255,255,0.6)]">
          30-day free trial · No credit card · Cancel anytime
        </p>
      </div>
    </section>
  );
}
