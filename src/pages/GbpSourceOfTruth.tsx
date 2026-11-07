import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";

export default function GbpSourceOfTruth() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="Local SEO Guide"
        title="Why Your Google Business Profile Should Be Your Single Source of Truth"
        lede="How CityWide Digital turns your GBP into a promotion engine for local search, social media, and directories — automatically."
      />

      {/* Article Body */}
      <section className="gp-section">
        <div className="gp-shell"><div className="gp-panel gp-article mx-auto max-w-[760px] px-6 py-10 md:px-10 md:py-12">
          <Link
            to="/about#faq"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-12 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to FAQ
          </Link>

          <div className="space-y-10">

            {/* Introduction */}
            <div className="space-y-4">
              <p className="text-lg text-muted-foreground leading-relaxed">
                For most Canadian local businesses, Google is the first place customers look. Your{" "}
                <a
                  href="https://forcefive.ca/blogs/news/google-business-profile-for-local-seo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  Google Business Profile (GBP)
                </a>{" "}
                is often the first impression they get of your company on Search and Maps. CityWide Digital turns that
                profile into the "source of truth" for your entire online presence, making it easier to stay visible,
                accurate, and competitive in your local market.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">What "Source of Truth" Means for Your Business</h2>
              <p className="text-muted-foreground leading-relaxed">
                A "source of truth" is the one place where your business information is always correct and up to date.
                In a local marketing context, that means your business name, address, phone number, website, hours,
                services, and photos all match across every platform customers might use — a cornerstone of{" "}
                <a
                  href="https://localdominator.co/local-citation-best-practices/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  local citation best practices
                </a>.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By designating your Google Business Profile as that source of truth — and managing it through{" "}
                <a
                  href="https://citywidedigital.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  CityWide
                </a>{" "}
                — you ensure that Search, Maps, your website, and major directories are all reading from the same script.
                This clarity helps both Google and your customers trust what they see.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">How CityWide Connects to Your Google Business Profile</h2>
              <p className="text-muted-foreground leading-relaxed">
                Connecting CityWide to your GBP takes only a few minutes. The platform securely links to your Google
                account and starts importing your business information, posts, menus, products, and photos. From there,
                your content flows into your{" "}
                <a
                  href="https://dashboard.citywidedigital.ca/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  CityWide-powered website
                </a>{" "}
                and across your connected channels automatically.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Any time you adjust your GBP — whether it's new hours, a holiday closure, or a new service —{" "}
                <a
                  href="https://citywidedigital.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  CityWide
                </a>{" "}
                picks up that change and syncs it out to your website and other connected destinations. You manage your
                business where Google cares the most, and CityWide handles the distribution.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Why GBP Matters So Much for Local Visibility</h2>
              <p className="text-muted-foreground leading-relaxed">
                Google Business Profile is the primary local listing Google uses to decide which businesses appear in
                Search, Maps, and the Local Pack. Without a complete, verified profile, you cannot show up in those
                high-impact positions, no matter how strong your website might be — as outlined in{" "}
                <a
                  href="https://www.coursera.org/articles/google-my-business-local-seo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  Google's local SEO guidelines
                </a>.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                When your profile is fully filled out — categories, services, photos, posts, and reviews — Google has
                more confidence in how relevant you are to nearby customers. That relevance, plus your proximity and
                prominence, are core factors in{" "}
                <a
                  href="https://forcefive.ca/blogs/news/google-business-profile-for-local-seo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  local rankings
                </a>
                , which is why an optimised GBP is so valuable.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Keeping Your Website in Sync Automatically</h2>
              <p className="text-muted-foreground leading-relaxed">
                CityWide automatically publishes a live{" "}
                <a
                  href="https://dashboard.citywidedigital.ca/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  website powered by your Google Business Profile content
                </a>
                . Instead of managing two separate sets of information, your site becomes a reflection of the data
                Google already trusts.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                This means when you update your services, add a new photo, or change your hours in GBP, the same
                information appears on your website with minimal extra effort. Search engines and customers see the same
                details on both Google and your site, which is exactly what{" "}
                <a
                  href="https://www.thisisgain.com/post/local-seo-citations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  local SEO best practices
                </a>{" "}
                recommend.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Consistent Listings Across 40+ Directories</h2>
              <p className="text-muted-foreground leading-relaxed">
                Local citation guides are clear: your name, address, phone number, and website must be consistent
                everywhere if you want strong local rankings. But manually checking and updating every directory is
                tedious and error-prone — something{" "}
                <a
                  href="https://www.youtube.com/watch?v=VaA_nGp539U"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  this local citations overview
                </a>{" "}
                covers well.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                CityWide handles this by using your GBP data as the template for correcting and syncing your details
                across more than 40 major directories. When you change something in your source of truth, CityWide
                pushes that update out, helping prevent old phone numbers or outdated addresses from hurting your
                visibility — in line with{" "}
                <a
                  href="https://localdominator.co/local-citation-best-practices/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  citation best practices
                </a>.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Turning One Post Into Many</h2>
              <p className="text-muted-foreground leading-relaxed">
                Posting regularly on your Google Business Profile helps show customers that your business is active and
                engaged. It also signals to Google that your listing is current, which can{" "}
                <a
                  href="https://alyft.ai/blog/google-business-profile-benefits/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  support better local visibility over time
                </a>.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                CityWide amplifies this by taking a single GBP post and publishing it across your connected social
                channels. Instead of copying and pasting content into separate apps, you create one update in your{" "}
                <a
                  href="https://citywidedigital.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  CityWide dashboard
                </a>
                , and your website, Google listing, and social feeds all stay aligned.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Reviews, Social Proof, and Conversions</h2>
              <p className="text-muted-foreground leading-relaxed">
                Reviews are one of the strongest trust signals in local search.{" "}
                <a
                  href="https://www.coursera.org/articles/google-my-business-local-seo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  Local SEO resources
                </a>{" "}
                highlight that businesses with more positive reviews and active responses tend to perform better in
                local rankings and win more clicks.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                CityWide pulls your Google reviews into{" "}
                <a
                  href="https://dashboard.citywidedigital.ca/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  your website
                </a>
                , letting visitors see real feedback without leaving your site. This alignment between your GBP, your
                website, and your other listings reinforces that customers are dealing with a legitimate, well-reviewed
                local business.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Less Administration, More Results</h2>
              <p className="text-muted-foreground leading-relaxed">
                The reality for most small and medium businesses is that digital admin work often falls to whoever has
                time, instead of a dedicated marketing team. That leads to outdated hours, inconsistent phone numbers,
                and social pages that go quiet for months.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By centralising management in CityWide and using GBP as your source of truth, you reduce the number of
                places you need to update. A single change cascades through your website, social channels, and
                directories, so you can keep everything accurate and active with far less effort — exactly the approach
                recommended in{" "}
                <a
                  href="https://www.thisisgain.com/post/local-seo-citations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  proven local citation strategies
                </a>.
              </p>
            </div>

            {/* Section */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-2xl font-bold text-foreground">Getting Started in Your CityWide Dashboard</h2>
              <p className="text-muted-foreground leading-relaxed">
                Once you log into your{" "}
                <a
                  href="https://citywidedigital.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  CityWide Digital dashboard
                </a>
                , your first step is to connect your Google Business Profile. From there, you can review the imported
                information, fill in any missing details, and start publishing posts directly from the platform.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                As you operate day to day, simply treat GBP as your master record: update it when your hours change,
                when you add a new service, or when you want to promote an offer. CityWide will take care of updating
                your site, keeping your social channels active, and maintaining{" "}
                <a
                  href="https://localdominator.co/local-citation-best-practices/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  accurate listings across the web
                </a>.
              </p>
            </div>

            {/* Closing callout */}
            <div className="pt-4 border-t border-border">
              <div className="bg-accent rounded-2xl p-8 border border-border">
                <p className="text-foreground leading-relaxed italic">
                  In practical terms, using Google Business Profile as your source of truth within CityWide means every
                  small action you take — a new photo, post, or update — goes further and works harder for your local
                  visibility than it would on its own.{" "}
                  <a
                    href="https://alyft.ai/blog/google-business-profile-benefits/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors not-italic font-medium"
                  >
                    Learn more about the benefits of an active Google Business Profile →
                  </a>
                </p>
              </div>
            </div>

          </div>
        </div>
        </div>
      </section>

      <GlassCTA kicker="Next / Get started" />
    </Layout>
  );
}
