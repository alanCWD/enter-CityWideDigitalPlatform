import { ArrowLeft, BookOpen, CalendarDays, Globe, MapPin, Share2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";

/**
 * Static, crawlable twin: public/google-posts-and-local-seo.html.
 * Keep the guide copy in both places in step.
 */
const mechanisms = [
  {
    label: "01 / Google",
    title: "Google posting",
    body: "Strengthens the business's presence inside Search and Maps with current, customer-facing updates.",
  },
  {
    label: "02 / Social",
    title: "Social syndication",
    body: "Expands where customers can encounter the business, and creates more paths back to the website.",
  },
  {
    label: "03 / Website",
    title: "Website content",
    body: "Creates pages Google can crawl, index and rank for specific services and local searches.",
  },
];

const profileCapabilities = [
  "Showcase specific services and products.",
  "Publish relevant local information.",
  "Promote seasonal offers and events.",
  "Give prospective customers more reasons to contact the business.",
  "Keep the Google profile useful and current.",
];

const syndicationOutcomes = [
  "Referral traffic to the website.",
  "Brand awareness.",
  "Customer engagement.",
  "Shares and mentions.",
  "Opportunities for other websites to discover and reference the business.",
];

const plumbingTopics = [
  "Hot water tank installations.",
  "Emergency plumbing repairs.",
  "Drain cleaning.",
  "Bathroom renovations.",
  "Seasonal plumbing maintenance.",
];

const plumbingSearches = [
  "Emergency plumber Victoria.",
  "Drain cleaning Victoria.",
  "Hot water tank replacement Victoria.",
];

const benefitRows = [
  ["Google posting", "Fresh customer-facing updates"],
  ["Social syndication", "Wider content distribution"],
  ["GBP synchronisation", "Consistent business information"],
  ["Website synchronisation", "Accurate website information"],
  ["Directory synchronisation", "Consistent business citations"],
  ["Reviews integration", "Customer trust and reputation"],
  ["Dedicated service pages", "Opportunity to rank for specific searches"],
];

const week = [
  ["Monday", "A service spotlight."],
  ["Wednesday", "A recent project or customer success story."],
  ["Friday", "An offer, a seasonal tip or a frequently asked question."],
];

const measures = [
  "Google Maps visibility.",
  "Organic website impressions.",
  "Website clicks.",
  "Phone calls.",
  "Enquiries.",
  "New customers.",
];

const ecosystemNodes = [
  {
    icon: Globe,
    title: "Website",
    body: "Business information and indexed content",
  },
  {
    icon: Share2,
    title: "Social channels",
    body: "Distribution and customer engagement",
  },
  {
    icon: BookOpen,
    title: "Directories",
    body: "Consistent business information",
  },
  {
    icon: Users,
    title: "Customers",
    body: "Discovery, enquiries and reviews",
  },
];

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 pl-1">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-muted-foreground leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function GooglePostsAndLocalSeo() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="Local SEO Guide"
        title="Do Google Posts and Social Media Actually Help Your SEO?"
        lede="Google posting, social syndication and website content all contribute to local search visibility — through three different mechanisms. The benefit compounds when all three run together."
      />

      <section className="gp-section">
        <div className="gp-shell">
          <div className="gp-panel gp-article mx-auto max-w-[820px] px-6 py-10 md:px-10 md:py-12">
            <Link
              to="/about#faq"
              className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Back to FAQ
            </Link>

            <p className="gp-kicker">Guide · Reviewed 25 November 2026</p>

            <div className="mt-8 space-y-10">
              <p className="text-lg leading-relaxed text-muted-foreground">
                Yes. Google posts, social syndication and website content all contribute to local search visibility —
                but through three different mechanisms, not one. We separate them because the distinction changes what
                a business should expect. Google does not treat post frequency as a direct local ranking factor, and
                likes and shares are not Google ranking signals. What does work is the combination: a current Google
                profile, consistent distribution and useful website pages built around the services a business sells.
              </p>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">Three mechanisms, not one</h2>
                <p className="leading-relaxed text-muted-foreground">
                  One update can do three separate jobs at once. Each contributes something different, and none
                  replaces the others.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {mechanisms.map((item) => (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="gp-kicker">{item.label}</p>
                      <h3 className="mt-2 text-sm font-medium text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">
                  Posting to Google strengthens the business's search presence
                </h2>
                <p className="leading-relaxed text-muted-foreground">
                  A post published from CityWide to Google Business Profile lets a business:
                </p>
                <Bullets items={profileCapabilities} />
                <p className="leading-relaxed text-muted-foreground">
                  Google does not officially identify post frequency as a direct local ranking factor. Its published
                  local ranking guidance centres on{" "}
                  <a
                    href="https://support.google.com/business/answer/7091"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                  >
                    relevance, distance and popularity
                  </a>
                  . A post earns its place by giving customers current, useful information, and by giving Google more
                  detail about what the business offers.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">
                  Social syndication expands distribution, not authority
                </h2>
                <p className="leading-relaxed text-muted-foreground">
                  This is where publishing from one place pays off. Through CityWide, a single post reaches
                  Google Business Profile, Facebook, Instagram, LinkedIn and the other connected platforms — more
                  opportunities for customers to encounter the business.
                </p>
                <p className="leading-relaxed text-muted-foreground">It also generates:</p>
                <Bullets items={syndicationOutcomes} />
                <p className="leading-relaxed text-muted-foreground">
                  The same qualification applies: likes and shares are not established direct Google ranking factors.
                  Social posts can be discovered in Google Search, but syndication does not create SEO authority by
                  itself.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">
                  The website is where the real SEO opportunity sits
                </h2>
                <p className="leading-relaxed text-muted-foreground">
                  A plumbing company in Victoria, BC is a useful example. Its updates cover:
                </p>
                <Bullets items={plumbingTopics} />
                <p className="leading-relaxed text-muted-foreground">
                  Through CityWide, those updates are distributed across Google and social while the website holds
                  synchronised business information. But the website is doing different work: it gives Google pages it
                  can crawl and index.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  Here is the distinction that matters. Synchronising Google Business Profile information is not the
                  same as creating SEO landing pages. If that plumber wants to rank for searches such as:
                </p>
                <Bullets items={plumbingSearches} />
                <p className="leading-relaxed text-muted-foreground">
                  … the website needs useful, relevant content addressing those services and searches. A Google post
                  about drain cleaning does not create a dedicated drain-cleaning landing page. Google's{" "}
                  <a
                    href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                  >
                    SEO Starter Guide
                  </a>{" "}
                  explains how useful website content and links help search engines discover and understand pages.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">The connected local SEO ecosystem</h2>
                <p className="leading-relaxed text-muted-foreground">
                  The right way to see the presence is as one system, not a set of channels. The Google Business
                  Profile holds the central business information; the website, social channels and directories carry
                  it to customers.
                </p>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
                  <div className="flex items-start gap-3 rounded-xl border border-[rgba(110,168,255,0.35)] bg-[rgba(110,168,255,0.08)] p-4">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--gp-blue)]" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Google Business Profile</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Central business information and publishing source
                      </p>
                    </div>
                  </div>

                  <div className="mx-auto my-4 h-6 w-px bg-white/15" aria-hidden="true" />

                  <div className="grid gap-3 sm:grid-cols-2">
                    {ecosystemNodes.map((node) => {
                      const Icon = node.icon;
                      return (
                        <div key={node.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-[var(--gp-blue)]" />
                            <p className="text-sm font-medium text-foreground">{node.title}</p>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{node.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                    Conceptual illustration of the connected ecosystem, not a guarantee that every post or update is
                    replicated identically.
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">What each capability actually contributes</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Each capability does a specific job. We keep them distinct rather than treating everything as "SEO",
                  because that is what keeps the expectations honest.
                </p>

                <div className="overflow-x-auto">
                  <table className="gp-table">
                    <thead>
                      <tr>
                        <th scope="col">CityWide capability</th>
                        <th scope="col">Search and marketing benefit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benefitRows.map(([capability, benefit]) => (
                        <tr key={capability}>
                          <td className="font-medium text-foreground">{capability}</td>
                          <td>{benefit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="leading-relaxed text-muted-foreground">
                  The last row matters most. Service-specific website content has to be deliberately built; it is not a
                  by-product of synchronisation.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">The weekly routine we recommend</h2>
                <p className="leading-relaxed text-muted-foreground">
                  For a typical local business, three posts a week keep the profile current without requiring a content
                  team:
                </p>

                <div className="overflow-hidden rounded-xl border border-white/10">
                  {week.map(([day, post], index) => (
                    <div
                      key={day}
                      className={`flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6 ${
                        index > 0 ? "border-t border-white/10" : ""
                      }`}
                    >
                      <p className="flex w-28 flex-shrink-0 items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-[var(--gp-blue)]" />
                        {day}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{post}</p>
                    </div>
                  ))}
                </div>

                <p className="leading-relaxed text-muted-foreground">
                  Publish to Google and distribute appropriate versions to social. Then measure:
                </p>
                <Bullets items={measures} />
                <p className="leading-relaxed text-muted-foreground">
                  Review after 8–12 weeks. Local visibility moves slowly, and a two-week sample misleads more often
                  than it informs.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">
                  Ongoing presence management, not a website project
                </h2>
                <p className="leading-relaxed text-muted-foreground">
                  Most website agencies sell a build, a launch and a maintenance plan. Google, social and directories
                  fall outside that scope, so they get managed separately — or not at all. CityWide runs the whole
                  presence as one system: business information is managed centrally, publishing happens from one
                  dashboard, the website stays synchronised, and content is distributed across the connected channels.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="gp-kicker">The traditional model</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      A website is built and maintained. Google, social media and directories are managed separately —
                      if they are managed at all.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[rgba(110,168,255,0.35)] bg-[rgba(110,168,255,0.08)] p-4">
                    <p className="gp-kicker">The CityWide model</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Business information is managed centrally, publishing runs from one dashboard, and the website
                      and connected channels stay synchronised.
                    </p>
                  </div>
                </div>

                <blockquote className="rounded-xl border border-[rgba(110,168,255,0.35)] bg-[rgba(110,168,255,0.08)] px-5 py-5">
                  <p className="text-base font-medium leading-relaxed text-foreground">
                    One business. One central dashboard. A connected online presence.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Every Google update becomes an opportunity to keep your website and social channels current,
                    maintain consistent business information and put your business in front of more potential
                    customers.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Less administration. More consistent marketing. More opportunities to be discovered.
                  </p>
                </blockquote>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">Why we don't promise ranking improvements</h2>
                <p className="leading-relaxed text-muted-foreground">
                  We do not promise automatic ranking improvements, because no provider honestly can. What we do
                  promise is a consistent foundation — accurate business information, a current profile, and a website
                  and channels that stay aligned — so that quality content and a strong reputation have something
                  reliable to build on.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  That is the realistic version of SEO for a local business: not one post that changes everything, but
                  a presence that stays current, stays accurate and keeps giving customers reasons to choose the
                  business.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GlassCTA
        kicker="Next / Put it into practice"
        title="One dashboard for Google, social and the website"
        lede="Start the 30-day trial with no card, or have us walk through the publishing workflow with your own profile."
      />
    </Layout>
  );
}
