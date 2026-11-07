import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { Shield, Mail, Phone } from "lucide-react";

const EFFECTIVE_DATE = "July 7, 2026";
const COMPANY = "CityWide Digital";
const EMAIL = "alan@citywidedigital.ca";
const PHONE = "250-882-7378";
const PROVINCE = "British Columbia, Canada";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-9">
      <h2 className="gp-mono mb-3 border-b border-white/10 pb-3 text-[10px] text-[var(--gp-ice)]">{title}</h2>
      <div className="space-y-3 text-sm font-light leading-relaxed text-[var(--gp-ink-72)]">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 pl-1">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export default function PrivacyPolicy() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="Legal / Privacy"
        title="Privacy Policy"
        lede={`Effective ${EFFECTIVE_DATE} · Last updated ${EFFECTIVE_DATE}`}
      >
        <span className="gp-chip gp-chip--accent">
          <Shield className="h-3 w-3" strokeWidth={1.75} /> Legal
        </span>
      </GlassHero>

      {/* Body */}
      <div className="gp-shell pb-20">
        <div className="gp-panel mx-auto max-w-3xl px-6 py-10 md:px-10 md:py-12">

        <Section title="1. Introduction">
          <P>
            {COMPANY} ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") is a digital marketing agency based in {PROVINCE}. We provide managed digital presence services to local businesses, including Google Business Profile management, review generation, social media coordination, website services, and related tools.
          </P>
          <P>
            This Privacy Policy explains how we collect, use, disclose, and safeguard personal information when you use our platform, client portal, and associated services (collectively, the "<strong>Services</strong>"). By accessing or using the Services, you consent to the practices described in this policy.
          </P>
          <P>
            We are committed to compliance with Canada's <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) and applicable British Columbia privacy legislation.
          </P>
        </Section>

        <Section title="2. Information We Collect">
          <P><strong>2.1 Information You Provide Directly</strong></P>
          <Ul items={[
            "Business name, address, phone number, and website URL",
            "Contact person name, email address, and phone number",
            "Billing information (processed by our payment partner, Stripe — we do not store full card numbers)",
            "Google Business Profile credentials and account access (via OAuth — we never see your Google password)",
            "QuickBooks Online credentials and account access (via OAuth — we never see your QuickBooks password)",
            "Account login credentials for your CityWide Digital portal",
            "Any notes, files, or information you upload to the Vault",
          ]} />
          <P><strong>2.2 Information Collected Automatically from Third-Party Integrations</strong></P>
          <Ul items={[
            "Google Business Profile data: business name, address, phone, hours, categories, photos, reviews, and posts",
            "QuickBooks Online invoice data: invoice ID, customer name, billing email address — used solely to trigger review request emails",
            "Customer email addresses from paid QBO invoices (used only to send the single review request email on your behalf)",
          ]} />
          <P><strong>2.3 Usage Data</strong></P>
          <Ul items={[
            "Log data: IP addresses, browser type, pages visited, timestamps",
            "Analytics data collected through our platform to improve the Services",
          ]} />
        </Section>

        <Section title="3. How We Use Your Information">
          <P>We use the information we collect to:</P>
          <Ul items={[
            "Deliver, operate, and maintain the Services you have subscribed to",
            "Sync and display your Google Business Profile data in your portal",
            "Automatically send review request emails to your customers when a QuickBooks Online invoice is marked as paid (on your behalf, as authorized by you)",
            "Process payments and manage billing through Stripe",
            "Send you service-related notifications (account alerts, invoices, renewal reminders)",
            "Respond to your support requests and communications",
            "Improve and develop new features for the platform",
            "Comply with our legal obligations",
          ]} />
          <P>
            We <strong>do not sell</strong> your personal information or your customers' personal information to third parties. We do not use your data for advertising purposes unrelated to our Services.
          </P>
        </Section>

        <Section title="4. Review Request Emails (QuickBooks Integration)">
          <P>
            When you connect your QuickBooks Online account, you authorize {COMPANY} to monitor your invoices and automatically send a review request email to your customer's billing email address when an invoice is fully paid. By enabling this feature, you confirm that:
          </P>
          <Ul items={[
            "You have the legal right to send marketing communications to those customers under applicable anti-spam legislation (Canada's CASL and any other applicable law)",
            "Your customers have provided consent, or a pre-existing business relationship exists that permits these communications",
            "You accept responsibility for ensuring compliance with CASL and other applicable email marketing laws",
          ]} />
          <P>
            Customer email addresses obtained through QuickBooks are used solely for the single review request email triggered by that specific paid invoice. We do not add these addresses to any marketing lists or share them with third parties.
          </P>
        </Section>

        <Section title="5. Sharing Your Information">
          <P>We may share information with the following categories of third parties, solely to provide the Services:</P>
          <Ul items={[
            "Supabase (database and authentication infrastructure — servers located in applicable jurisdictions)",
            "Stripe (payment processing — subject to Stripe's Privacy Policy)",
            "Intuit / QuickBooks (OAuth authentication and invoice data access — subject to Intuit's Privacy Policy)",
            "Google (GBP OAuth and API access — subject to Google's Privacy Policy)",
            "Resend (transactional email delivery for review request emails — subject to Resend's Privacy Policy)",
            "Law enforcement or government bodies when required by applicable law",
          ]} />
          <P>We require all third-party processors to maintain appropriate security standards and use data only as directed by us.</P>
        </Section>

        <Section title="6. Data Retention">
          <P>
            We retain your business and account data for the duration of your subscription plus a reasonable period thereafter (typically 90 days) to allow for account reinstatement, dispute resolution, and legal compliance. Review request logs are retained for up to 2 years for audit purposes. You may request deletion of your data at any time by contacting us.
          </P>
          <P>
            Customer email addresses collected through QBO invoices are retained in our logs only as long as necessary to demonstrate compliance and troubleshoot delivery issues.
          </P>
        </Section>

        <Section title="7. Data Security">
          <P>
            We implement industry-standard technical and organizational measures to protect your data, including encryption in transit (TLS), encryption at rest, role-based access controls, and regular security reviews. However, no method of transmission over the internet is 100% secure.
          </P>
        </Section>

        <Section title="8. Your Rights">
          <P>Under PIPEDA and applicable provincial laws, you have the right to:</P>
          <Ul items={[
            "Access the personal information we hold about you",
            "Request correction of inaccurate information",
            "Withdraw consent for certain uses (subject to legal or contractual limitations)",
            "Request deletion of your personal information",
            "File a complaint with the Office of the Privacy Commissioner of Canada",
          ]} />
          <P>To exercise any of these rights, please contact us at the address below.</P>
        </Section>

        <Section title="9. Cookies and Tracking">
          <P>
            Our platform uses session cookies and local storage to maintain your login state. We do not use third-party advertising cookies. Analytics data, if collected, is used solely to improve the platform.
          </P>
        </Section>

        <Section title="10. Children's Privacy">
          <P>
            Our Services are not directed to individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected such information, please contact us immediately.
          </P>
        </Section>

        <Section title="11. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. We will notify active subscribers of material changes by email or through an in-platform notice. Continued use of the Services after the effective date of any update constitutes acceptance of the revised policy.
          </P>
        </Section>

        <Section title="12. Contact Us">
          <P>If you have questions or concerns about this Privacy Policy, or to exercise your privacy rights, please contact:</P>
          <div className="gp-inset mt-4 space-y-2 p-5">
            <p className="font-semibold text-foreground">{COMPANY}</p>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--gp-ice)]" />
              <a href={`mailto:${EMAIL}`} className="text-[var(--gp-ice)] hover:underline">{EMAIL}</a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--gp-ice)]" />
              <a href={`tel:${PHONE.replace(/-/g, "")}`} className="text-[var(--gp-ice)] hover:underline">{PHONE}</a>
            </div>
            <p className="text-[var(--gp-ink-72)]">{PROVINCE}</p>
          </div>
        </Section>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-[11px] font-light text-[var(--gp-ink-38)]">
          <p>&copy; {new Date().getFullYear()} {COMPANY}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}
