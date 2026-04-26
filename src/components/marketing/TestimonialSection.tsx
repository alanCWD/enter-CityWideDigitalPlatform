import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Maria Gonzalez",
    business: "Maria's Kitchen, Austin TX",
    role: "Restaurant Owner",
    avatar: "MG",
    stars: 5,
    quote: "I used to spend half my Sunday updating my website and posting everywhere. Now I post once on Google and everything else just happens. I've gotten 3 catering calls this month from my website alone.",
    highlight: "3 catering calls this month",
  },
  {
    name: "Jason Thibodeaux",
    business: "ThiboRoofing, Baton Rouge LA",
    role: "Roofing Contractor",
    avatar: "JT",
    stars: 5,
    quote: "My listings were everywhere — wrong phone number on Yelp, wrong address on Apple Maps. CityWide fixed all of it in a day and I've kept it accurate ever since. My lead quality is way up.",
    highlight: "Fixed 23 directory errors",
  },
  {
    name: "Sandra Okonkwo",
    business: "Radiant Boutique, Atlanta GA",
    role: "Retail Store Owner",
    avatar: "SO",
    stars: 5,
    quote: "The video reviews feature was a game changer. My customers love leaving quick video reviews and new shoppers trust those way more than star ratings. My Google ranking jumped in 6 weeks.",
    highlight: "Google ranking jumped in 6 weeks",
  },
];

export default function TestimonialSection() {
  return (
    <section className="py-20 md:py-28 bg-[#1B2A4A]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Success Stories</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#EEF1FA] leading-tight mb-4">
            Real results for real businesses
          </h2>
          <p className="text-[rgba(238,241,250,0.6)] text-lg max-w-xl mx-auto">
            Over 2,400 local businesses trust CityWide Digital to manage their entire digital presence.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-[#0F1E38] rounded-2xl p-7 border border-white/10 flex flex-col">
              <Quote className="w-8 h-8 text-primary/40 mb-4" />
              
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              <blockquote className="text-[rgba(238,241,250,0.8)] text-sm leading-relaxed flex-1 mb-6">
                "{t.quote}"
              </blockquote>

              {/* Highlight pill */}
              <div className="inline-flex items-center gap-1.5 bg-[#22C55E]/15 border border-[#22C55E]/25 rounded-full px-3 py-1 mb-5 self-start">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                <span className="text-[#4ADE80] text-xs font-semibold">{t.highlight}</span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <div className="w-10 h-10 rounded-full bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#EEF1FA]">{t.name}</div>
                  <div className="text-xs text-[rgba(238,241,250,0.5)]">{t.business}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
