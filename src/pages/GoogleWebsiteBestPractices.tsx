import { ArrowLeft, Building2, FileCheck2, Globe2, ListChecks, Search, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";

/**
 * Static, crawlable twin: public/google-website-best-practices.html.
 * Keep the guide copy in both places in step.
 */
const trustPages = [
  {
    icon: Building2,
    title: "About page",
    body: "Explains who the business is, where it operates and who the people behind it are. Real names, photos and history make the trust part of E-E-A-T visible, and give customers a reason to choose you over a directory listing.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy policy",
    body: "Explains what you collect through forms, cookies and analytics, why you collect it, and how people can reach you. Canadian businesses should check their obligations under privacy law, and have the policy reviewed by a lawyer.",
  },
  {
    icon: FileCheck2,
    title: "Terms of service",
    body: "Sets out your rules for bookings, refunds, warranties and general website use, so expectations are clear before a customer gets in touch.",
  },
  {
    icon: Globe2,
    title: "Copyright notice",
    body: "A simple \"© year, Business Name\" line in the footer, backed by owning or licensing every image and block of text you publish.",
  },
];

const checklist = [
  "Each page has a unique, descriptive title and meta description.",
  "Each page has one clear H1, followed by logical H2 and H3 headings.",
  "Content is original, helpful and shows real experience.",
  "Images have descriptive alt text.",
  "LocalBusiness structured data matches the visible page.",
  "An About page introduces the business, where it operates and the people behind it.",
  "Privacy policy, terms of service and copyright notice are published.",
  "Name, address, phone number and hours match everywhere.",
];

const handled = [
  ["Hosting, performance, page structure and SEO setup", "CityWide"],
  ["Basic SEO on every plan", "CityWide"],
  ["Unique titles, headings and meta descriptions on template pages", "CityWide"],
  ["LocalBusiness structured data matching your profile", "CityWide"],
  ["Privacy policy, terms and copyright footer templates", "CityWide"],
  ["Custom copy, campaign pages and new sections", "Site Concierge"],
];

const faqs = [
  {
    q: "Does a privacy policy help me rank?",
    a: "Google does not list it as a ranking factor. It supports customer trust and legal compliance.",
  },
  {
    q: "What's the ideal title length?",
    a: "Google doesn't set one. It asks for titles that are clear, concise and accurate.",
  },
  {
    q: "Will Google always show my meta description?",
    a: "No. Google may write its own snippet from the page, so treat the meta description as a strong suggestion rather than a guaranteed result.",
  },
  {
    q: "Can anyone guarantee rankings?",
    a: "No. Good practice makes your site eligible and easy to understand. It doesn't guarantee a position, and any provider promising one should be treated with caution.",
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

function GoogleLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
    >
      {children}
    </a>
  );
}

export default function GoogleWebsiteBestPractices() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="Guide · Managed local presence"
        title="Website Best Practices for Google: A Local Business Guide"
        lede="A website that ranks isn't built on tricks. It's built on clear pages, accurate facts and a few basics done properly every time."
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
                Google's guidance for a local business website is plain. Write helpful pages for people, give every
                page a unique title, keep the technical basics clean, and make your business facts match everywhere.
                This guide covers what Google recommends, the trust pages that support it, and which of the basics
                CityWide Digital handles for you.
              </p>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">1. Write for people first</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Google's ranking systems are designed to prioritise helpful, reliable information created to benefit
                  people, not content created to manipulate rankings. Google describes E-E-A-T as experience,
                  expertise, authoritativeness and trustworthiness — and says that of these, trust is the most
                  important.{" "}
                  <GoogleLink href="https://developers.google.com/search/docs/fundamentals/creating-helpful-content">
                    Google: creating helpful content
                  </GoogleLink>
                </p>
                <p className="leading-relaxed text-muted-foreground">For a local business, that means:</p>
                <Bullets
                  items={[
                    "Say who you are, where you are and what you do.",
                    "Show real experience, such as your own photos, completed projects and customer reviews.",
                    "Answer the questions customers actually ask before they call.",
                    "Don't write pages just to catch search terms.",
                  ]}
                />
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">2. Title tags: your headline in search results</h2>
                <p className="leading-relaxed text-muted-foreground">
                  The title link is the headline of a search result, and it helps people decide whether to click.
                  Google builds it from the <code>&lt;title&gt;</code> element and other headings on the page, and may
                  rewrite it when a clearer title is available.{" "}
                  <GoogleLink href="https://developers.google.com/search/docs/appearance/title-link">
                    Google: influencing title links
                  </GoogleLink>
                </p>
                <p className="leading-relaxed text-muted-foreground">Best practices:</p>
                <Bullets
                  items={[
                    "Make every title unique to its page.",
                    "Keep it clear, concise and accurate.",
                    "Put the service and location first, such as \"Emergency Plumber in Langford, BC | Business Name\".",
                    "Never use the same title on every page.",
                  ]}
                />
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">3. Headings, H1 to H3</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Google says to break long content into paragraphs and sections, and to use headings to help people
                  navigate. It also says there is no magical, ideal number of headings per page.{" "}
                  <GoogleLink href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide">
                    Google: SEO starter guide
                  </GoogleLink>
                </p>
                <Bullets
                  items={[
                    "Use one H1 that describes the page, since Google's helpful-content questions ask whether the main heading gives a descriptive summary.",
                    "Use H2 and H3 headings to organise subtopics in a logical order.",
                    "Don't use headings just for styling or to stuff in search terms.",
                  ]}
                />
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">4. Meta descriptions</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Google sometimes uses the meta description as the snippet under your title. A good one is short,
                  unique to one page and covers the page's most relevant points. Google may also write its own from the
                  page, so a meta description is not guaranteed to appear.{" "}
                  <GoogleLink href="https://developers.google.com/search/docs/appearance/snippet">
                    Google: controlling snippets
                  </GoogleLink>
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">5. Crawlable, semantic pages</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Google's developer guidance is straightforward. Make the site easy to read and easy to follow:
                </p>
                <Bullets
                  items={[
                    "Use links Google can crawl, built from real anchor elements rather than scripts or click handlers.",
                    "Give every page a descriptive title and meta description.",
                    "Use semantic HTML, so the purpose of each block is clear.",
                  ]}
                />
                <p className="leading-relaxed text-muted-foreground">
                  Also write descriptive alt text for images, and use readable URLs that say what the page is about.{" "}
                  <GoogleLink href="https://developers.google.com/search/docs/crawling-indexing/links-crawlable">
                    Google: crawlable links
                  </GoogleLink>{" "}
                  ·{" "}
                  <GoogleLink href="https://developers.google.com/search/docs/appearance/google-images">
                    Google: image best practices
                  </GoogleLink>
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">6. Structured data for local businesses</h2>
                <p className="leading-relaxed text-muted-foreground">
                  LocalBusiness structured data tells Google about your location, opening hours and other business
                  details. Google recommends JSON-LD. To be eligible for rich results, the markup must include the
                  required properties and follow Google's general structured data guidelines.{" "}
                  <GoogleLink href="https://developers.google.com/search/docs/appearance/structured-data/local-business">
                    Google: LocalBusiness structured data
                  </GoogleLink>
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  The markup must match what visitors can see on the page. Wrong or stale markup is worse than none:
                  eligibility is not a guarantee, and a mismatch between the data and the visible page undermines both.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">7. Trust pages: about, privacy, terms and copyright</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Google's own documentation doesn't list an About page, a privacy policy, terms of service or a
                  copyright notice as ranking factors. They are trust and legal basics, not tricks: they tell visitors
                  who you are, what you promise and how you handle their information. A site that collects emails,
                  bookings or analytics data should have all of them.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {trustPages.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <Icon className="h-4 w-4 text-[var(--gp-blue)]" aria-hidden="true" />
                      <h3 className="mt-3 text-sm font-medium text-foreground">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Show a real address, phone number and email as well. Contact information supports trust, and it
                  should match the details on your Google Business Profile.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">8. Keep your facts consistent</h2>
                <p className="leading-relaxed text-muted-foreground">
                  Your name, address, phone number, hours and services should match across your website, your Google
                  Business Profile and the directories customers use. Inconsistency is one of the easiest ways for a
                  business to look out of date, and it gives search engines conflicting answers about the same company.
                </p>
                <p className="leading-relaxed text-muted-foreground">
                  CityWide syncs supported details from your Google profile, so one update reaches your website and
                  connected channels. Directory listings across 40+ sites are included on Growth and Pro.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="text-2xl font-bold text-foreground">9. What CityWide handles</h2>
                <p className="leading-relaxed text-muted-foreground">
                  The technical and structural basics are included, so the site starts from a sound foundation rather
                  than from a redesign project.
                </p>
                <div className="overflow-x-auto">
                  <table className="gp-table">
                    <thead>
                      <tr>
                        <th scope="col">Basic</th>
                        <th scope="col">Handled by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {handled.map(([item, owner]) => (
                        <tr key={item}>
                          <td className="font-medium text-foreground">{item}</td>
                          <td>{owner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="leading-relaxed text-muted-foreground">
                  Custom copy, campaign pages and new sections sit outside the automatic sync. They go through Site
                  Concierge, so anything bespoke is quoted and delivered deliberately rather than assumed.
                </p>
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                  <ListChecks className="h-5 w-5 text-[var(--gp-blue)]" aria-hidden="true" />
                  10. Quick checklist
                </h2>
                <Bullets items={checklist} />
              </div>

              <div className="space-y-4 border-t border-border pt-6">
                <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                  <Search className="h-5 w-5 text-[var(--gp-blue)]" aria-hidden="true" />
                  Frequently asked questions
                </h2>
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
        kicker="Next / Start with the basics"
        title="Let the site handle the fundamentals"
        lede="Connect your Google Business Profile and CityWide builds a site with the structure and business facts in place. 30-day free trial, no card required."
      />
    </Layout>
  );
}
