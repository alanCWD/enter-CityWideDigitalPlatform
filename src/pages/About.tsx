import { Target, Lightbulb, Shield, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const values = [
  {
    icon: Target,
    title: "Results Over Complexity",
    description: "We believe great technology should simplify your life, not add more to your plate. Every feature we build has one goal: make local businesses more visible with less effort.",
  },
  {
    icon: Users,
    title: "Small Businesses Deserve Enterprise Tools",
    description: "Large chains have dedicated marketing teams. We level the playing field by giving independent businesses the same digital infrastructure — at a fraction of the cost.",
  },
  {
    icon: Lightbulb,
    title: "Built on Real Insights",
    description: "Our tools are built from thousands of conversations with restaurant owners, contractors, and retailers. We understand your problems because we've listened to them.",
  },
  {
    icon: Shield,
    title: "Your Data, Protected",
    description: "We're transparent about how we use your business data. We never sell it, and we never lock you in. Your information is yours, always.",
  },
];

const faqSections = [
  {
    id: "web-apps",
    title: "Why We Build Web Apps",
    subtitle: "What makes our approach different — and better",
    items: [
      {
        q: "What exactly is a web app, and why is it better than a regular website?",
        a: "A web app is a dynamic application that runs in your browser — unlike a static website, it stays connected to live data sources like your Google Business Profile. CityWide's web app pulls in your latest business information, posts, menus, and photos automatically, so your online presence stays current without manual updates. It's faster to maintain, more accurate, and built to do far more than just display static content.",
      },
      {
        q: "My business is small. Do I really need something that sophisticated?",
        a: "The sophistication is under the hood — on your end, it's just your business information staying current online. CityWide's web app is actually simpler to manage than a traditional website because it does the maintenance for you. There's no developer on call, no hosting configuration, and no plugin library to worry about. The more complex parts work silently in the background so you don't have to.",
      },
      {
        q: "How quickly can I get up and running?",
        a: "Most businesses are live within a few days of connecting their Google Business Profile. Once your GBP is linked, CityWide imports your core business information, builds your site structure, and applies your design. From there, any refinements are fast because the foundation is already built from your existing data.",
      },
      {
        q: "Will my site look unique, or will it look like a template everyone else has?",
        a: "Your site is built from niche-specific design frameworks — restaurants look like restaurants, contractors look like contractors — but your content, colours, photos, and brand information make it entirely yours. Because your real business data powers the site, no two CityWide sites look identical.",
      },
      {
        q: "What if I want to update my content later — like changing my menu or prices?",
        a: "That's exactly what CityWide is built for. Update your menu, services, or prices in your Google Business Profile, and your website reflects the change automatically. For more custom changes, our Site Concierge service lets you describe what you need in plain English and our team handles the rest.",
      },
      {
        q: "My current website is just old and outdated. Is that enough of a reason to switch?",
        a: "Absolutely. An outdated website damages trust, hurts your local search ranking, and sends potential customers to competitors who look more credible online. If your site shows the wrong hours, an old menu, or hasn't been updated in years, it's actively working against you. CityWide solves this permanently by keeping your site in sync with your Google Business Profile automatically.",
      },
    ],
  },
  {
    id: "vs-shopify",
    title: "CityWide Digital vs. Shopify",
    subtitle: "Why Shopify isn't the right fit for most local businesses",
    items: [
      {
        q: "I've heard of Shopify. Why wouldn't I just use that?",
        a: "Shopify is built for e-commerce — it's designed around product catalogues, shopping carts, and checkout flows. Most local service businesses (restaurants, contractors, salons, trades) don't need any of that. CityWide is built specifically for local businesses: it connects to your Google Business Profile, manages your local search presence, and handles the channels your customers actually use to find you.",
      },
      {
        q: "But Shopify has templates and it looks easy. Isn't that a plus?",
        a: "Templates are easy to start but create problems the moment you need something that doesn't fit the mould. You end up hiring a developer or compromising your vision. CityWide's niche-specific designs are purpose-built for how your type of business presents itself online — with far less customisation friction and without the e-commerce infrastructure you'll never use.",
      },
      {
        q: "What about the ongoing monthly fees with Shopify?",
        a: "Shopify fees stack quickly. Beyond the base plan, you'll pay for premium themes, apps to handle bookings, reviews, and local features, plus transaction fees. CityWide bundles what local businesses actually need — Google sync, social publishing, directory listings, and review management — into a predictable monthly rate with no add-on creep.",
      },
      {
        q: "Can Shopify handle things like appointment bookings or service enquiries?",
        a: "Not natively — you'd need to install and pay for third-party apps, then configure them to work with your workflow. CityWide is designed with service businesses in mind. Your enquiry flow, contact options, and lead capture are part of the platform, not add-ons you have to stitch together yourself.",
      },
      {
        q: "Is Shopify even suitable if I don't sell physical products?",
        a: "Not really. Shopify's entire architecture is built around inventory management and checkout. If you're a restaurant, contractor, or any service business, you'd be paying for and managing infrastructure you don't need. CityWide starts from your actual business model: local visibility, consistent information, and turning online searches into real customers.",
      },
    ],
  },
  {
    id: "vs-wordpress",
    title: "CityWide Digital vs. WordPress",
    subtitle: "Why the world's most popular website builder isn't always the right choice",
    items: [
      {
        q: "WordPress powers millions of websites. Why would I choose anything else?",
        a: "WordPress is an excellent publishing platform — for blogs and content-heavy sites. But a local business website has different requirements: it needs to stay accurate, rank in local search, and integrate with platforms like Google Business Profile and directories. WordPress doesn't do any of that on its own. You'd need plugins, hosting, updates, and technical maintenance that most small business owners aren't set up to handle.",
      },
      {
        q: "I've been told WordPress is free. Is that true?",
        a: "WordPress the software is free to download, but running it isn't. You'll pay for hosting, a premium theme, the plugins needed to function properly, and often a developer when something breaks. The total cost of ownership is frequently higher than a purpose-built platform like CityWide, and it comes with ongoing technical overhead that takes time away from running your business.",
      },
      {
        q: "What's the biggest practical problem with WordPress for a small business?",
        a: "Maintenance. WordPress requires regular updates to the core software, themes, and plugins — and those updates sometimes break things. Without someone technical to manage it, a WordPress site can go offline, get compromised, or stop working after an update. CityWide handles all of that so you're never in a position where your website is down and you don't know why.",
      },
      {
        q: "Are WordPress sites slow?",
        a: "They can be, especially as plugins accumulate. Page speed is critical for both user experience and local search rankings, and poorly optimised WordPress sites regularly underperform. CityWide's platform is built for performance from the start — there's no plugin bloat, and your site is served from infrastructure optimised for speed.",
      },
      {
        q: "What about security? I've heard WordPress sites get hacked.",
        a: "WordPress is the most targeted CMS on the internet because of how widespread it is. Vulnerabilities in plugins and themes are regularly exploited. Keeping a WordPress site secure requires ongoing updates, security plugins, and monitoring. CityWide manages security at the platform level, so you don't have to think about it.",
      },
      {
        q: "Can WordPress grow with my business?",
        a: "WordPress can technically do almost anything with the right developer and plugin budget, but that growth comes with increasing complexity and cost. CityWide grows with you more practically — as your business evolves on Google, adding services, locations, or new content, your online presence updates accordingly without needing a developer every time something changes.",
      },
    ],
  },
  {
    id: "google",
    title: "CityWide Digital and Google",
    subtitle: "How your Google presence is managed from one place",
    items: [
      {
        q: "Why is Google Business Profile central to CityWide Digital?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            Google Business Profile is where local customers find you — in Search, on Maps, and in the Local Pack.
            It's also the most complete, Google-verified record of your business. By connecting CityWide directly to
            your GBP, we ensure your entire online presence starts from the most authoritative source available and
            stays in sync with it automatically.{" "}
            <Link
              to="/gbp-local-listing"
              className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium transition-colors"
            >
              Read our full guide on why GBP is your most important local listing →
            </Link>
          </p>
        ),
      },
      {
        q: "How does the app simplify updating my business information on Google?",
        a: "Instead of logging into multiple platforms to make the same change, you make it once — either in your Google Business Profile or directly in CityWide — and the update flows outward from there. Hours changes, new services, holiday closures: one action, consistent results across your website, social channels, and directory listings.",
      },
      {
        q: "What kinds of content can CityWide Digital manage on my Google Business Profile?",
        a: "CityWide can manage your core business information (name, address, phone, hours), posts, offers, events, menus, service lists, and products. It imports that content into your website and pushes updates out when things change, keeping your GBP content working harder across more channels.",
      },
      {
        q: "How does using Google Business Profile as a \"source of truth\" help my local visibility?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            A complete, accurate, and regularly updated Google Business Profile is one of the strongest signals for
            local visibility in Google Search and Maps. By centralising updates in CityWide Digital, you're far more
            likely to keep your profile fully optimised — which supports better rankings in the Local Pack and more
            discovery from "near me" searches. Your business{" "}
            <Link
              to="/gbp-source-of-truth"
              className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium transition-colors"
            >
              source of truth
            </Link>{" "}
            helps your local visibility.
          </p>
        ),
      },
      {
        q: "Can CityWide Digital help me manage Google reviews more effectively?",
        a: "Yes. CityWide surfaces your Google reviews in your dashboard and automatically embeds them on your website. This means your positive reviews support trust on your site, not just on Google Maps. Monitoring reviews from one place also makes it easier to respond promptly, which is a factor that supports stronger local rankings.",
      },
      {
        q: "How does the app handle posts and events on Google?",
        a: "You can create posts and events directly in your CityWide dashboard and publish them to your Google Business Profile. That same content can simultaneously be syndicated to your connected social channels, so one update goes further without extra effort.",
      },
      {
        q: "What are the benefits of syncing my menu, services, or products through CityWide Digital?",
        a: "When your menu or service list is connected through CityWide, customers see the same information whether they find you on Google, visit your website, or check a directory. There's no risk of your website showing an outdated menu while Google shows something different — everything reflects your current offering, which builds trust and reduces customer confusion.",
      },
      {
        q: "How does this improve my team's day-to-day workflow?",
        a: "It eliminates duplicate work. Instead of updating your website, social media, and directory profiles separately every time something changes, one update in the right place handles the distribution automatically. That frees up time for work that actually requires a person.",
      },
      {
        q: "Does using CityWide Digital change how my business appears on Google Search and Maps?",
        a: "CityWide helps you get more out of what Google already shows. By keeping your GBP complete, accurate, and regularly updated with posts and content, you improve the quality of your presence in Search and Maps. We don't override what Google displays — we help you maximise the visibility Google gives you.",
      },
      {
        q: "Can I see how my Google Business Profile is performing?",
        a: "Yes. CityWide's analytics dashboard shows how customers are finding and interacting with your Google Business Profile — views, searches, direction requests, calls, and website clicks. That data helps you understand what's working and where there's room to improve your local visibility.",
      },
      {
        q: "Is there any benefit for my other marketing channels when I centralise Google Business Profile in CityWide Digital?",
        a: "Definitely. When GBP is your master record, updates flow automatically to your website and social channels — so your Facebook, Instagram, and other profiles stay active and accurate without separate effort. Consistent activity across channels signals to Google that your business is engaged, which supports your overall local search performance.",
      },
      {
        q: "What happens if I update something directly in Google instead of through the app?",
        a: "CityWide syncs with your Google Business Profile, so changes made directly in GBP are picked up by the platform. The relationship is flexible — you can manage from CityWide, from Google, or from both. What matters is that your GBP stays accurate, because that's what drives consistency across your entire presence.",
      },
      {
        q: "What does \"Google Business Profile as a source of truth\" mean?",
        a: "It means your Google Business Profile (GBP) becomes the single, master record for your business details — such as name, address, phone number, hours, services, and photos. Everything else (your website, directories, and social channels) is kept in sync with that core profile.",
      },
      {
        q: "How does this help my local visibility on Google?",
        a: "A complete, accurate, and regularly updated GBP is one of the strongest signals Google uses for local search and Maps. When your profile is fully optimised and active, you're more likely to appear in the Local Pack and \"near me\" searches.",
      },
      {
        q: "Why is consistency across platforms so important?",
        a: "Google and customers both look for matching information across your website, Google listing, and directories. When your details are consistent everywhere, it builds trust and reduces confusion, which helps your local rankings and click-through rates.",
      },
      {
        q: "How does CityWide Digital make this easier?",
        a: "CityWide connects directly to your GBP and uses it to power your website, keep 40+ directories up to date, and syndicate posts to your social channels. You update once (in CityWide or GBP), and the platform takes care of the rest in the background.",
      },
      {
        q: "What's the practical benefit for a busy local business?",
        a: "Less admin, more impact. Instead of logging into multiple sites to change hours, promotions, or services, you update in one place. That single action improves your website, your Google presence, and your wider citation footprint all at once.",
      },
      {
        q: "How does this approach help convert more customers?",
        a: "When your GBP, website, and directories all show the same up-to-date information and reviews, customers gain confidence quickly. Clear details and strong social proof mean more calls, visits, and bookings from the people who find you online.",
      },
      {
        q: "Where can I read the full article on this?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            You can read the full explanation, with examples and best practices, in our detailed article here:{" "}
            <Link
              to="/gbp-source-of-truth"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80 font-medium transition-colors"
            >
              Read the full guide on using Google Business Profile as your source of truth
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </p>
        ),
      },
    ],
  },
  {
    id: "facebook-alone",
    title: "Why Facebook Alone Isn't Enough For Local Visibility",
    subtitle: "The limitations of relying on social media as your primary presence",
    items: [
      {
        q: "What's the problem with running my business primarily through Facebook?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            Facebook is not a primary local search listing, so it doesn't drive the same "near me" visibility in Google
            Search and Maps that a well-optimised Google Business Profile does. If you depend on Facebook alone,{" "}
            <a
              href="https://www.flento.io/blog/facebook-business-page-vs-google-business-profile"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              you're basically invisible to many high-intent searchers
            </a>{" "}
            who never see your Page.
          </p>
        ),
      },
      {
        q: "Doesn't a Facebook Page act like a website and listing in one?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            A Facebook Page can mimic a basic website, but it's{" "}
            <a
              href="https://www.integritive.com/drawbacks-of-facebook-as-business-site/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              built on rented land
            </a>
            : you have limited control over layout, SEO, and data ownership. Visitors often need to log in, are
            distracted by unrelated content, and can't always access core details cleanly on mobile — all of which
            hurt conversion compared to a proper site powered by GBP data.
          </p>
        ),
      },
      {
        q: "How does discovery differ between Facebook and Google?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            Facebook relies on followers, shares, and the news feed algorithm, so{" "}
            <a
              href="https://studiovaliente.com/blog/facebook-groups-small-business"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              reach can be unpredictable and can drop if Meta changes the rules
            </a>
            . Google Business Profile, on the other hand, is designed for intent-based local searches, and is
            consistently one of the strongest drivers of new customer acquisition.
          </p>
        ),
      },
      {
        q: "What are the risks of using Facebook groups instead of a structured local presence?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            <a
              href="https://studiovaliente.com/blog/facebook-groups-small-business"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              Local Facebook groups are noisy, oversaturated environments
            </a>{" "}
            where messages compete with dozens of other posts and aren't targeted precisely at your ideal customers.
            Relying on them means your visibility is fragile, and your brand is buried inside someone else's feed
            rather than anchored to a clear, findable profile in Google.
          </p>
        ),
      },
      {
        q: "Does social media activity directly improve my Google rankings?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            No — social activity is a supporting signal, not a primary ranking factor. It can drive traffic and brand
            awareness, but{" "}
            <a
              href="https://www.localseotactics.com/can-social-media-really-help-your-local-seo-heres-what-to-know/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              without a strong Google Business Profile and consistent citations
            </a>
            , those visits don't translate into sustainable local search authority.
          </p>
        ),
      },
    ],
  },
  {
    id: "gbp-foundation",
    title: "Why GBP + CityWide Should Be Your Foundation",
    subtitle: "The smarter strategy: GBP-first, with social as a distribution channel",
    items: [
      {
        q: "Why is Google Business Profile more important than Facebook for local businesses?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            GBP is the main citation Google uses to decide who appears in local Search and Maps results, especially
            the Local Pack. For most businesses, it's{" "}
            <a
              href="https://www.coursera.org/articles/google-my-business-local-seo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              the single most effective acquisition channel for new local customers
            </a>
            ; Facebook is better for engagement and repeat touchpoints, not first discovery.
          </p>
        ),
      },
      {
        q: "How does using GBP as a source of truth help my Facebook strategy?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            When GBP is your source of truth, your core business details stay consistent everywhere, and{" "}
            <a
              href="https://citywidedigital.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              CityWide can push posts, updates, and promos out to Facebook and other socials
            </a>{" "}
            from one central profile. You get the best of both worlds: strong search visibility from GBP, plus social
            reach from Facebook, without duplicating admin work.
          </p>
        ),
      },
      {
        q: "Why is it risky to have mismatched information between Facebook and Google?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            If your name, address, phone, or hours differ between Facebook and Google, Google may ignore those social
            signals or even downgrade trust in your listing. Using GBP with CityWide keeps your NAP consistent across
            social, website, and directories, which is a{" "}
            <a
              href="https://localdominator.co/local-citation-best-practices/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              core requirement for effective local SEO
            </a>.
          </p>
        ),
      },
      {
        q: "How does CityWide improve on a \"Facebook-only\" model?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            CityWide connects your Google Business Profile to a live website and to major directories, then lets you
            syndicate content to Facebook, Instagram, X, and more from a{" "}
            <a
              href="https://dashboard.citywidedigital.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              single dashboard
            </a>
            . Instead of trying to run your business inside Facebook's ecosystem, you own your presence through GBP
            and your site, and use Facebook as an amplifier — not the foundation.
          </p>
        ),
      },
      {
        q: "What's the preferred strategy: GBP, Facebook, or both?",
        a: "",
        renderAnswer: () => (
          <p className="text-muted-foreground leading-relaxed">
            The optimal play is GBP-first, with Facebook and other socials used as distribution channels that pull
            from your source of truth. Complete and maintain your GBP,{" "}
            <a
              href="https://citywidedigital.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              connect it to CityWide
            </a>
            , then let the platform push accurate information and promotions out to Facebook rather than trying to
            build your entire digital presence inside a single social network.
          </p>
        ),
      },
    ],
  },
];

export default function About() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="01 / Our story"
        scene
        title="We built CityWide because local businesses deserve better"
        lede="Every local business owner we've ever met has the same problem: not enough time, not enough budget, and too many digital tools to manage."
      />

      {/* Story */}
      <section className="gp-section">
        <div className="gp-shell">
          <div className="gp-panel p-7 md:p-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] lg:gap-14">
              <div>
                <p className="gp-kicker">02 / Why we exist</p>
                <h2 className="gp-display mt-4 text-[clamp(1.6rem,2.8vw,2.2rem)]">
                  The problem we saw everywhere
                </h2>
              </div>
              <div className="gp-body space-y-5 text-[15px] md:text-base">
                <p>
                  We spent years working with hundreds of small businesses across the country — restaurants, roofers, boutiques, salons. The same story repeated over and over: they had a Google Business Profile that was more or less up to date, but their website was outdated, their directory listings had the wrong phone number, and their social pages went silent for weeks at a time.
                </p>
                <p>
                  None of these owners were lazy. They were busy running their businesses. The problem wasn't effort — it was that managing a digital presence across five different platforms is a part-time job nobody signed up for.
                </p>
                <p className="text-[var(--gp-ink)]">
                  So we built CityWide Digital. One platform that uses the data you already maintain on Google to keep your entire digital presence up to date — automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="gp-section">
        <div className="gp-shell">
          <div className="mb-12 max-w-2xl">
            <p className="gp-kicker">03 / Principles</p>
            <h2 className="gp-display mt-4 text-[clamp(1.7rem,3.4vw,2.6rem)]">What we stand for</h2>
            <p className="gp-lede mt-4">Four principles guide every decision we make.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div key={v.title} className="gp-panel gp-panel--soft gp-panel--hover p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06]">
                  <v.icon className="h-5 w-5 text-[var(--gp-ice)]" strokeWidth={1.5} />
                </span>
                <h3 className="mt-5 text-base font-normal text-[var(--gp-ink)]">{v.title}</h3>
                <p className="gp-body mt-2 text-[13px]">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="gp-section scroll-mt-24">
        <div className="gp-shell">
          <div className="mb-12 max-w-2xl">
            <p className="gp-kicker">04 / Resources</p>
            <h2 className="gp-display mt-4 text-[clamp(1.7rem,3.4vw,2.6rem)]">
              Simple answers to common questions
            </h2>
            <p className="gp-lede mt-4">
              No jargon. Just clear explanations about why a modern web app beats the alternatives — and why it matters for your business.
            </p>
          </div>

          <div className="space-y-6">
            {faqSections.map((section, index) => (
              <div key={section.id} className="gp-panel overflow-hidden">
                <div className="border-b border-white/8 px-6 py-5 md:px-8">
                  <p className="gp-kicker">{String(index + 1).padStart(2, "0")} / {section.title}</p>
                  <p className="gp-body mt-2 text-[13px]">{section.subtitle}</p>
                </div>
                <div className="px-6 md:px-8">
                  <Accordion type="single" collapsible>
                    {section.items.map((item, i) => (
                      <AccordionItem key={i} value={`${section.id}-${i}`} className="border-b-0">
                        <AccordionTrigger className="gp-accordion-trigger gap-4 py-4 text-left text-sm font-normal text-[var(--gp-ink)] hover:no-underline">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="gp-body text-[13.5px]">
                          {item.renderAnswer ? (
                            item.renderAnswer()
                          ) : (
                            <p>{item.a}</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GlassCTA kicker="05 / Get started" />
    </Layout>
  );
}
