import { ArrowLeft, Bot, FileText, Globe2, MapPin, MessageSquareText, Search, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";

/**
 * Static, crawlable twin: public/ai-search-local-businesses.html.
 * Keep the guide copy in both places in step.
 */
const layers = [
  {
    icon: Search,
    label: "01 / Answers",
    title: "AI answers",
    body: "Summaries that answer a question directly and link to the sources they used.",
  },
  {
    icon: MessageSquareText,
    label: "02 / Recommendations",
    title: "Assistant recommendations",
    body: "A customer asks for the best option nearby and receives a short list of businesses.",
  },
  {
    icon: Bot,
    label: "03 / Agents",
    title: "Agents",
    body: "Tools that compare options, check availability or act on a customer's behalf.",
  },
];

const syncFields = [
  "Business name, address and phone number",
  "Website link and primary category",
  "Opening hours and holiday hours",
  "Menus, products and Google posts",
  "Google reviews and ratings",
];

const losses = [
  "Google shows one set of hours and the website shows another.",
  "Directory listings are years out of date.",
  "The website blocks crawlers or hides its content behind scripts.",
  "The Google profile is thin, with few reviews and no recent posts.",
  "Nobody owns the upkeep.",
];

const foundations = [
  ["Accurate business facts", "Synced from the Google Business Profile"],
  ["A site that can be read", "Managed hosting, page structure, performance and SEO setup"],
  ["Agreement across the web", "Social sync, plus 40+ directory listings on Growth and Pro"],
  ["Evidence of an active business", "Google posts, reviews and the Review Engine"],
];

const plans = [
  {
    name: "Starter",
    price: "$197",
    featured: false,
    includes: [
      "GMB-synced website",
      "Industry template",
      "Custom domain support",
      "Social sync — Google plus 2 platforms",
      "Post scheduling",
      "Basic SEO",
    ],
  },
  {
    name: "Growth",
    price: "$397",
    featured: true,
    includes: [
      "Everything in Starter",
      "Social sync — Google plus 3 platforms",
      "40+ directory listings",
      "Monthly performance report",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    price: "$597",
    featured: false,
    includes: [
      "Everything in Growth",
      "Social sync — up to 10 platforms",
      "Review Engine",
      "AI chatbot intake",
      "3 Site Concierge credits per month",
      "Dedicated account manager",
    ],
  },
];

const audiences = [
  ["Restaurants and cafés", "Menus and hours change often."],
  ["Retailers", "Products and stock need to stay current."],
  ["Contractors and service businesses", "You need to be easy to find and call."],
  ["Owner-operators", "You do not have time to maintain five channels."],
];

const faqs = [
  {
    q: "Can you guarantee I'll show up in ChatGPT?",
    a: "No one can. CityWide improves the accuracy and consistency of the information AI tools find. Whether a tool recommends a business is up to that tool.",
  },
  {
    q: "Do I need an llms.txt file?",
    a: "It is optional, and its value for AI visibility is unproven. Google Search ignores it, and no AI platform has confirmed it helps. Accurate data and a crawlable site matter more.",
  },
  {
    q: "Will this replace my SEO?",
    a: "No. It builds on the same foundation: a strong Business Profile, consistent listings and a fast, readable website.",
  },
  {
    q: "Does CityWide put my business inside ChatGPT?",
    a: "No. There is no paid placement inside these assistants. CityWide makes the public information about your business accurate and consistent, so a tool that looks has a better chance of getting the details right.",
  },
  {
    q: "How do I test my visibility?",
    a: "Ask an AI assistant the questions your customers would ask. Check whether it recommends you and whether it gets your hours, services and location right.",
  },
];

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 pl-1">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 leading-relaxed text-muted-foreground">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function AiSearchLocalBusinesses() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="Service Guide · AI Search"
        title="AI Search for Local Businesses: How CityWide Digital Keeps You Visible"
        lede="Customers are asking AI who to call. CityWide keeps the information those tools find accurate, current and consistent."
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

            <p className="gp-kicker">Guide · Reviewed 26 November 2026</p>

            <div className="mt-8 space-y-10">
              <p className="text-lg leading-relaxed text-muted-foreground">
                AI tools do not maintain a separate directory you can claim. When someone asks ChatGPT, Gemini,
                Perplexity or Google's AI Mode for a local recommendation, the answer is assembled from sources those
                systems already trust: indexed web pages, Google Business Profile data and consistent listings across
                the web. CityWide's job is to keep those sources saying the same, accurate thing.
              </p>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">What AI search is</h2>
                <p className="leading-relaxed text-muted-foreground">
                  AI search tools answer questions directly. A customer might ask, "Which Victoria café is open late
                  on Sunday?" The tool assembles a response from sources it can read, then names the businesses it is
                  most confident about.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {layers.map(({ icon: Icon, label, title, body }) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <Icon className="h-4 w-4 text-[var(--gp-blue)]" aria-hidden="true" />
                      <p className="gp-kicker mt-3">{label}</p>
                      <h3 className="mt-2 text-sm font-medium text-foreground">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Google's own guidance is unusually clear: to appear in AI Overviews or AI Mode, a page must be
                  indexed and eligible to show a snippet. There are no additional technical requirements.{" "}
                  <a
                    href="https://developers.google.com/search/docs/appearance/ai-features"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                  >
                    Google's AI features guide
                  </a>{" "}
                  treats AI visibility as a continuation of normal search, not a separate channel.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">How AI picks local businesses</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Google's AI features are built on its Search systems, and local ranking still comes down to{" "}
                  <a
                    href="https://support.google.com/business/answer/7091"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
                  >
                    relevance, distance and popularity
                  </a>
                  : how well the profile matches the query, how close the business is, and how well known and reviewed
                  it is.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  Consistency matters for the same reason it matters in search. When hours, address and services match
                  across sources, there is less for a tool to get wrong. When they conflict, the safe answer is often
                  to skip the business.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  AI tools are not omniscient. They quote what they can read, and they can only be as current as the
                  sources they find.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">Where businesses lose visibility</h2>
                <Bullets items={losses} />
                <p className="leading-relaxed text-muted-foreground">
                  AI tools read data literally. Vague copy, missing hours or a website that cannot be crawled give
                  them little to work with — and plenty of reasons to choose a competitor instead.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">How CityWide handles the foundation</h2>
                <p className="leading-relaxed text-muted-foreground">
                  CityWide does not sell a shortcut into AI answers. It removes the common reasons a tool would get
                  your business wrong.
                </p>

                <div className="space-y-5">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
                      <MapPin className="h-4 w-4 text-[var(--gp-blue)]" aria-hidden="true" />
                      One source of truth
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      You manage your business information in Google. CityWide's website follows, with supported
                      changes appearing as soon as they are saved — near real-time. The synced fields include:
                    </p>
                    <div className="mt-3">
                      <Bullets items={syncFields} />
                    </div>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
                      <Globe2 className="h-4 w-4 text-[var(--gp-blue)]" aria-hidden="true" />
                      One update, many channels
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      The same information goes out to your connected social channels, and to 40-plus directories on
                      Growth and Pro. Every consistent copy is one less contradiction for an AI tool to find.
                    </p>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
                      <ShieldCheck className="h-4 w-4 text-[var(--gp-blue)]" aria-hidden="true" />
                      The technical side, handled
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      CityWide manages hosting, page structure, performance and SEO setup. There are no plugins for
                      you to update. Google's advice for AI features is the same as its advice for search: allow
                      crawling, make important content available as text, keep structured data matching what is
                      visible, and keep your Business Profile current. CityWide maintains the technical setup; the
                      profile supplies the facts.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--gp-blue)]" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-foreground">On llms.txt and AI-specific files</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        You may hear that an llms.txt file is the key to AI visibility. It is optional, Google Search
                        ignores it, and no AI platform has confirmed it improves recommendations. CityWide publishes
                        one on its own website as a summary for tools that choose to read it — not as a ranking lever.
                        Accurate data and a crawlable site matter more.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="gp-table">
                    <thead>
                      <tr>
                        <th scope="col">What AI tools need</th>
                        <th scope="col">What CityWide provides</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foundations.map(([need, role]) => (
                        <tr key={need}>
                          <td className="font-medium text-foreground">{need}</td>
                          <td>{role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">Ready for AI agents</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Agents need clear, current information about what you offer, when you are open and how to reach you.
                  Because the website mirrors the profile, those details stay accurate without a second content
                  system to maintain.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  A clear contact path and consistent details give a tool something reliable to work from. That does
                  not make you the answer an assistant gives, but it gives a customer who arrives ready to act
                  somewhere useful to land.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">What you still do</h2>
                <p className="leading-relaxed text-muted-foreground">CityWide does the heavy lifting, but a few things stay with you:</p>
                <Bullets
                  items={[
                    "Keep your Google Business Profile complete and accurate.",
                    "Ask customers for reviews and respond to them.",
                    "Request custom pages or copy through Site Concierge. These sit outside the automatic sync.",
                  ]}
                />
                <p className="leading-relaxed text-muted-foreground">
                  No provider can guarantee that an AI tool will recommend you. What we can do is make sure that when
                  it looks, it finds the right answer.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">Plans</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Prices are in CAD, plus GST. The 30-day trial requires no card, there is no setup fee, and you can
                  cancel anytime.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`flex flex-col rounded-xl border p-4 ${
                        plan.featured
                          ? "border-[rgba(110,168,255,0.45)] bg-[rgba(110,168,255,0.08)]"
                          : "border-white/10 bg-white/[0.02]"
                      }`}
                    >
                      <p className="gp-kicker">{plan.name}</p>
                      <p className="mt-2 text-2xl font-light text-foreground">
                        {plan.price} <span className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">/ mo</span>
                      </p>
                      <ul className="mt-4 space-y-2">
                        {plan.includes.map((item) => (
                          <li key={item} className="text-sm leading-relaxed text-muted-foreground">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">Who benefits most</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {audiences.map(([who, why]) => (
                    <div key={who} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <p className="text-sm font-medium text-foreground">{who}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{why}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">Frequently asked questions</h2>
                <div className="space-y-4">
                  {faqs.map((faq) => (
                    <div key={faq.q}>
                      <h3 className="text-base font-medium text-foreground">{faq.q}</h3>
                      <p className="mt-1.5 leading-relaxed text-muted-foreground">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GlassCTA
        kicker="Next / Start with the profile"
        title="Give AI tools a better answer to find"
        lede="Connect your Google Business Profile and CityWide builds the rest. 30-day free trial, no card required."
      />
    </Layout>
  );
}
