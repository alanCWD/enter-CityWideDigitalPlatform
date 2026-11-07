import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { FileText, Mail, Phone } from "lucide-react";

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

export default function TermsOfService() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="Legal / Terms"
        title="Terms of Service"
        lede={`Effective ${EFFECTIVE_DATE} · Last updated ${EFFECTIVE_DATE}. This agreement also serves as the End User License Agreement (EULA) for the ${COMPANY} platform.`}
      >
        <span className="gp-chip gp-chip--accent">
          <FileText className="h-3 w-3" strokeWidth={1.75} /> Legal
        </span>
      </GlassHero>

      {/* Body */}
      <div className="gp-shell pb-20">
        <div className="gp-panel mx-auto max-w-3xl px-6 py-10 md:px-10 md:py-12">

        <Section title="1. Agreement to Terms">
          <P>
            These Terms of Service ("<strong>Terms</strong>" or "<strong>Agreement</strong>") constitute a legally binding agreement between you ("<strong>Client</strong>", "<strong>you</strong>", or "<strong>your</strong>") and <strong>{COMPANY}</strong> ("<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>"), a digital marketing agency based in {PROVINCE}.
          </P>
          <P>
            By signing up for, accessing, or using any {COMPANY} service, platform, or portal (collectively, the "<strong>Services</strong>"), you agree to be bound by these Terms. If you do not agree, you may not use the Services. If you are accepting these Terms on behalf of a business, you represent that you have authority to bind that business.
          </P>
        </Section>

        <Section title="2. Description of Services">
          <P>
            {COMPANY} provides managed digital presence services to local businesses, which may include:
          </P>
          <Ul items={[
            "Google Business Profile (GBP) management and optimization",
            "Review generation and monitoring",
            "Automated review request emails triggered by QuickBooks Online invoice payments",
            "Social media content scheduling and management",
            "Website design, maintenance, and hosting",
            "Local citation and listing management",
            "Business intelligence reporting and analytics",
            "Client portal access for business owners",
            "CRM tools for agency management of client accounts",
          ]} />
          <P>
            The specific Services you receive are determined by your subscription plan or service agreement. We reserve the right to modify, add, or discontinue features with reasonable notice.
          </P>
        </Section>

        <Section title="3. Account Registration and Access">
          <P>
            To access the Services, you must create an account with accurate and complete information. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
          </P>
          <P>
            You must be at least 18 years old and legally authorized to operate a business in your jurisdiction to use the Services.
          </P>
        </Section>

        <Section title="4. License Grant">
          <P>
            Subject to these Terms and payment of applicable fees, {COMPANY} grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Services solely for your internal business purposes during the term of your subscription.
          </P>
          <P>
            You may not: (a) sublicense, resell, or redistribute access to the platform; (b) reverse-engineer, decompile, or disassemble any component of the Services; (c) use the Services to develop a competing product; or (d) remove any proprietary notices from the platform.
          </P>
        </Section>

        <Section title="5. Third-Party Integrations and Authorizations">
          <P><strong>5.1 Google Business Profile.</strong> By connecting your Google account, you authorize {COMPANY} to access, read, and update your GBP listing data on your behalf using Google's official OAuth authorization flow. We never access your Google password.</P>
          <P><strong>5.2 QuickBooks Online.</strong> By connecting your QuickBooks Online account, you authorize {COMPANY} to:</P>
          <Ul items={[
            "Access your invoice data to detect when invoices are marked as paid",
            "Read the billing email address associated with paid invoices",
            "Send a single automated review request email to that customer on your behalf",
          ]} />
          <P>
            You represent and warrant that you have obtained all necessary consents from your customers as required by Canada's <em>Anti-Spam Legislation</em> (CASL) and any other applicable law before enabling this feature. You accept sole responsibility for compliance with CASL and applicable email marketing regulations.
          </P>
          <P><strong>5.3 Stripe.</strong> Payment processing is handled by Stripe. By providing payment information, you agree to Stripe's Terms of Service. We do not store full credit card numbers.</P>
          <P><strong>5.4 Third-Party Accounts.</strong> Use of third-party platforms (Google, Intuit, Stripe, etc.) is subject to their respective terms of service. We are not responsible for changes to third-party APIs or platform policies that may affect the Services.</P>
        </Section>

        <Section title="6. Fees and Payment">
          <P>
            Subscription fees are billed in advance on a monthly or annual basis, as set out in your service agreement or chosen plan. All fees are in Canadian dollars unless otherwise stated. Taxes (including GST/HST) will be added where applicable.
          </P>
          <P>
            If your payment fails, we may suspend access to the Services after reasonable notice. Refunds are provided at our discretion and are generally not issued for partial months of service.
          </P>
          <P>
            We reserve the right to change our pricing with 30 days' written notice. Continued use of the Services after the effective date of a price change constitutes acceptance of the new fees.
          </P>
        </Section>

        <Section title="7. Your Responsibilities">
          <P>You agree to:</P>
          <Ul items={[
            "Provide accurate, current, and complete information about your business",
            "Comply with all applicable laws, including CASL, PIPEDA, and any laws governing your industry",
            "Ensure your customers' email addresses are used in compliance with anti-spam legislation",
            "Not use the Services to send unsolicited communications, spam, or fraudulent content",
            "Not use the Services in any manner that could damage, disable, or impair our infrastructure",
            "Not attempt to gain unauthorized access to other accounts or systems",
            "Maintain proper authorization before connecting third-party accounts (Google, QuickBooks, etc.)",
          ]} />
        </Section>

        <Section title="8. Intellectual Property">
          <P>
            All software, designs, content, trademarks, and materials constituting the {COMPANY} platform are owned by {COMPANY} or our licensors and are protected by applicable intellectual property laws. Nothing in these Terms transfers any intellectual property rights to you.
          </P>
          <P>
            You retain all ownership of your business data, content, and materials that you upload to or connect through the Services. You grant {COMPANY} a limited license to use that data solely to provide the Services.
          </P>
        </Section>

        <Section title="9. Confidentiality">
          <P>
            Each party agrees to keep confidential any non-public information of the other party that is disclosed in connection with the Services and that is identified as confidential or would reasonably be understood to be confidential. This obligation does not apply to information that is publicly available or independently developed.
          </P>
        </Section>

        <Section title="10. Disclaimers">
          <P>
            THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY SPECIFIC RESULTS WILL BE ACHIEVED.
          </P>
          <P>
            We do not guarantee any particular outcome from digital marketing services, including improvements in search rankings, review volume, or customer acquisition.
          </P>
          <P>
            We are not responsible for the actions, policies, or availability of third-party platforms including Google, Intuit, or Stripe.
          </P>
        </Section>

        <Section title="11. Limitation of Liability">
          <P>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {COMPANY.toUpperCase()}'S TOTAL LIABILITY TO YOU ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE FEES YOU PAID IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
          </P>
          <P>
            IN NO EVENT SHALL {COMPANY.toUpperCase()} BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </P>
        </Section>

        <Section title="12. Indemnification">
          <P>
            You agree to indemnify, defend, and hold harmless {COMPANY} and its officers, employees, and agents from and against any claims, damages, losses, and expenses (including reasonable legal fees) arising out of: (a) your use of the Services; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) your failure to comply with applicable laws, including CASL.
          </P>
        </Section>

        <Section title="13. Term and Termination">
          <P>
            These Terms remain in effect for the duration of your subscription. Either party may terminate the relationship upon 30 days' written notice. We may terminate immediately if you breach these Terms materially or fail to pay fees when due.
          </P>
          <P>
            Upon termination: (a) your access to the Services will cease; (b) we will retain your data for 90 days to allow for export; (c) provisions relating to intellectual property, confidentiality, limitation of liability, and governing law survive termination.
          </P>
        </Section>

        <Section title="14. Governing Law and Dispute Resolution">
          <P>
            These Terms are governed by the laws of the Province of British Columbia and the federal laws of Canada applicable therein, without regard to conflict of law principles. Any disputes shall be resolved in the courts of British Columbia, and both parties consent to the exclusive jurisdiction of those courts.
          </P>
        </Section>

        <Section title="15. Changes to These Terms">
          <P>
            We may modify these Terms at any time. We will provide at least 14 days' notice of material changes by email or in-platform notification. Your continued use of the Services after the effective date constitutes acceptance of the updated Terms. If you do not agree to the changes, you may terminate your subscription before they take effect.
          </P>
        </Section>

        <Section title="16. General Provisions">
          <Ul items={[
            "Entire Agreement: These Terms, together with your service agreement and our Privacy Policy, constitute the entire agreement between you and CityWide Digital.",
            "Severability: If any provision is found unenforceable, the remaining provisions continue in full force.",
            "Waiver: Failure to enforce any provision is not a waiver of future enforcement.",
            "Assignment: You may not assign your rights under these Terms without our prior written consent. We may assign freely.",
            "Notices: Formal notices to us should be sent by email to " + EMAIL + ".",
          ]} />
        </Section>

        <Section title="17. Contact Us">
          <P>If you have questions about these Terms, please contact:</P>
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
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  );
}
