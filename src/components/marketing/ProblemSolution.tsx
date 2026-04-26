import { XCircle, CheckCircle } from "lucide-react";

const problems = [
  "Your website hasn't been updated in months",
  "Posting to social media takes hours every week",
  "Your business info is wrong on half the directories",
  "You have no time to respond to or collect reviews",
  "Customers can't find you online or find outdated info",
];

const solutions = [
  "Your website auto-updates from your Google Business Profile",
  "One GMB post instantly publishes to all social platforms",
  "All 40+ directories stay accurate and synced automatically",
  "Video reviews are collected and displayed on your site",
  "Customers always find fresh, accurate information",
];

export default function ProblemSolution() {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">The Problem We Solve</p>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary leading-tight">
            Most SMBs are invisible online — and don't even know it
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Problem Column */}
          <div className="bg-red-50 rounded-2xl p-8 border border-red-100">
            <h3 className="text-lg font-bold text-red-700 mb-6 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              The Old Way
            </h3>
            <ul className="space-y-4">
              {problems.map((problem) => (
                <li key={problem} className="flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-red-200 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  </div>
                  <span className="text-red-700 text-sm leading-relaxed">{problem}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution Column */}
          <div className="bg-[#F0F5FF] rounded-2xl p-8 border border-[#0078D7]/15">
            <h3 className="text-lg font-bold text-[#00447A] mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#22C55E]" />
              The CityWide Way
            </h3>
            <ul className="space-y-4">
              {solutions.map((solution) => (
                <li key={solution} className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 w-5 h-5 text-[#22C55E] flex-shrink-0" />
                  <span className="text-[#1B2A4A] text-sm leading-relaxed font-medium">{solution}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
