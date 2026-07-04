import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import CTABanner from "@/components/marketing/CTABanner";

export default function GbpLocalListing() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_100%)] -mt-[88px] pt-[128px] pb-20 md:pt-[152px] md:pb-28">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Local SEO Guide</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#EEF1FA] mb-5 leading-tight text-balance">
            Why Google Business Profile is Your Most Important Local Listing
          </h1>
          <p className="text-lg text-[rgba(238,241,250,0.7)] max-w-2xl mx-auto">
            How connecting CityWide directly to your GBP turns one verified profile into the engine powering your entire online presence.
          </p>
        </div>
      </section>

      {/* Article Body */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-[760px] mx-auto px-6">
          <Link
            to="/about#faq"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-12 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to FAQ
          </Link>

          <div className="space-y-10">

            {/* Intro */}
            <p className="text-lg text-muted-foreground leading-relaxed">
              Google Business Profile is where local customers find you — in Search, on Maps, and in the Local Pack.
              It's also the most complete, Google-verified record of your business. By connecting CityWide directly to
              your GBP, we ensure your entire online presence starts from the most authoritative source available and
              stays in sync with it automatically.
            </p>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Why Google Business Profile Matters So Much</h2>
              <p className="text-muted-foreground leading-relaxed">
                When someone nearby searches "pizza near me," "plumber in Langford," or "coffee shop open now," Google
                doesn't start by looking at Facebook or Instagram — it starts with Google Business Profile. GBP is the
                primary local listing Google uses to decide which businesses show up in Search results, on Maps, and in
                the high-impact Local Pack. A complete, verified profile is the baseline for being discovered by local
                customers who are ready to visit, call, or book.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Beyond visibility, GBP is structured around all the details customers care about most: your name,
                address, phone number, hours, categories, services, photos, and reviews. Because this data is verified
                and managed within Google's own ecosystem, it carries more weight than information scattered across
                social feeds or directories. Treating GBP as your master record means your most important business
                details are always correct in the place people look first.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">GBP As Your Authoritative Source of Truth</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your Google Business Profile is essentially a live, Google-verified snapshot of your business. It's the
                one profile designed specifically for local intent — "near me" searches, city-based queries, and map
                lookups — and it's engineered to capture every key detail about your operation. When that profile is
                fully filled out and regularly updated, it becomes the most authoritative, machine-readable
                representation of your business online.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Using GBP as your "source of truth" means you base everything else on that record. If your hours
                change, you update GBP first. If you add a new service or product line, you describe it clearly in your
                profile. If you refresh your branding or photos, GBP gets the latest visuals. Instead of juggling
                conflicting information across platforms, you decide that whatever is in GBP is correct — and then you
                sync the rest of your presence from there.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">How CityWide Connects Directly To Your GBP</h2>
              <p className="text-muted-foreground leading-relaxed">
                CityWide is designed around one simple principle: you shouldn't have to update your business details in
                ten different places to stay visible and accurate. By connecting CityWide directly to your Google
                Business Profile, we turn your verified Google listing into the engine that powers your website, your
                directory listings, and your content across multiple channels.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Once connected, CityWide reads your GBP data — business name, address, phone number, website, hours,
                services, menus, photos, and even posts. That information becomes the foundation of your
                CityWide-powered site and the baseline for other integrations. As you change or refine your GBP,
                CityWide updates your connected assets automatically, keeping everything aligned with what Google knows
                about your business.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Your Website, Powered by GBP Data</h2>
              <p className="text-muted-foreground leading-relaxed">
                A common problem for local businesses is that websites and Google listings drift apart over time. The
                site says you close at 6:00 pm, but GBP shows 7:00 pm. The site lists older services, while GBP
                includes the new offerings you added last month. These inconsistencies confuse both customers and search
                engines.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                CityWide solves this by building and maintaining a website that pulls directly from your GBP. Your core
                contact details, hours, and primary services come from your verified profile, so what customers see on
                your site matches what they see in Search and on Maps. When you update GBP — say, changing your hours
                for summer or adding a new service category — CityWide reflects those changes on your site without
                requiring a separate content-management workflow.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Keeping Directories and Citations In Sync</h2>
              <p className="text-muted-foreground leading-relaxed">
                Local SEO isn't just about Google; it's also about the dozens of directories and citation sources that
                reinforce your presence online. Each of those listings is another opportunity for customers to find you
                — but it's also another place where inconsistent information can cause confusion or erode trust.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Because CityWide treats GBP as your source of truth, it can use that verified record to power updates
                across many of these third-party platforms. Instead of manually adjusting your name, address, phone
                number, or hours on each site, you maintain a single, authoritative profile in GBP. CityWide then helps
                keep your wider citation footprint consistent with that record, so customers see the same details
                wherever they look and search engines can confidently match all those signals back to your business.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Social Channels as Distribution, Not the Foundation</h2>
              <p className="text-muted-foreground leading-relaxed">
                Social platforms like Facebook, Instagram, and X are excellent for storytelling, promotions, and
                engagement — but they're not built to be your primary local listing. Algorithms change, reach
                fluctuates, and your content is surrounded by distractions. If you try to run your entire digital
                presence "inside" a social network, your visibility depends on forces you don't control.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The better strategy is to treat social as distribution. With CityWide connected to your GBP, you can
                create posts and updates that start from your verified business data and then push those messages out to
                social channels. Your core facts — who you are, where you are, when you're open, what you offer —
                stay anchored in Google Business Profile and your website. Social amplifies your message, but your
                source of truth remains stable and authoritative.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Automatic Syncing Reduces Errors and Saves Time</h2>
              <p className="text-muted-foreground leading-relaxed">
                Every mismatch in your online presence has a cost. A wrong phone number can mean a lost booking. Old
                hours can lead to frustrated customers at a locked door. Conflicting service lists can result in
                enquiries for things you no longer provide. The more places you manually update, the more likely these
                errors become.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By connecting CityWide directly to GBP, you reduce that risk dramatically. You focus on keeping one
                profile accurate and complete; CityWide makes sure everything else follows. That automatic syncing cuts
                down on repetitive admin work and significantly lowers the chance of outdated or conflicting
                information. Over time, this consistency builds trust with both customers and search engines, which
                supports better visibility and stronger conversion.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Building Trust Through Verified Information and Reviews</h2>
              <p className="text-muted-foreground leading-relaxed">
                Trust is central to local business success. Customers want to know that your details are correct, that
                your photos reflect reality, and that your reviews are genuine. Google Business Profile is uniquely
                positioned to support that trust, because it combines verified business information with a robust review
                system and clear policies on authenticity.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                CityWide leverages that trust by using your GBP as the backbone of your site and wider presence. When
                your site reflects the same information and reviews that people see on Google, it feels more credible
                and consistent. Visitors don't have to reconcile different stories from different platforms; they get a
                unified picture of your business wherever they find you.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">The Net Result: A Stronger, Simpler Local Strategy</h2>
              <p className="text-muted-foreground leading-relaxed">
                When you view GBP as just another profile, you miss its strategic value. When you treat it as your
                source of truth — and connect CityWide directly to it — your entire local strategy becomes stronger and
                simpler:
              </p>
              <ul className="space-y-3 pl-1">
                {[
                  "You are discoverable where it matters most: on Google Search, Maps, and in the Local Pack.",
                  "Your website and directories stay aligned with the most authoritative, Google-verified record of your business.",
                  "Social channels become amplifiers of accurate information, rather than fragile stand-alone hubs.",
                  "Updates happen once, in one place, and cascade through your presence automatically.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-muted-foreground leading-relaxed">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                For a busy local business, that combination — visibility, authority, consistency, and reduced admin —
                is what turns digital infrastructure into a genuine growth engine. Instead of wrestling with fragmented
                tools and outdated listings, you build everything on top of the one profile Google trusts the most, and
                let CityWide keep it all in sync.
              </p>
            </div>

          </div>
        </div>
      </section>

      <CTABanner />
    </Layout>
  );
}
