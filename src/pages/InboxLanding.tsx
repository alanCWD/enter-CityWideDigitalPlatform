import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { question: "Where do I find Inbox?", answer: "Inbox is available in the CityWide dashboard. Sign in and select Inbox from the dashboard navigation to view the conversations available to your account." },
  { question: "Which messages appear in Inbox?", answer: "Inbox is designed to bring messages from connected channels together. The conversations available depend on your connected accounts and their supported messaging capabilities." },
  { question: "Can I reply to customers from Inbox?", answer: "Yes. Open a conversation in the dashboard Inbox to read its messages and respond, subject to the connected channel's messaging rules and availability." },
  { question: "What are the Pro messaging tools?", answer: "The dashboard includes Pro tabs for broadcasts, sequences and automations. Access depends on your plan, and supported actions can vary by connected channel." },
  { question: "Can I use Inbox without the CityWide dashboard?", answer: "Not yet. A standalone app is planned for use on its own or alongside the CityWide suite, but it is not currently available." },
];

export default function InboxLanding() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="Inbox Pro Guide"
        title="Understanding Inbox Pro"
        lede="A guide to managing customer conversations in your CityWide dashboard and the tools available as your messaging needs grow."
      />
      <section className="gp-section">
        <div className="gp-shell">
          <article className="gp-panel gp-article mx-auto max-w-[760px] px-6 py-10 md:px-10 md:py-12">
            <Link to="/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-12 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to services
            </Link>
            <div className="space-y-10">
              <p className="text-lg text-muted-foreground leading-relaxed">Customer conversations can arrive across different channels. Inbox brings the conversations available from your connected accounts into your CityWide dashboard, giving you a central place to read messages and respond.</p>
              <section className="space-y-4 pt-4 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">How Inbox works</h2>
                <p className="text-muted-foreground leading-relaxed">Open Inbox in the dashboard to see your conversation list. Select a conversation to read its messages and reply from the same workspace. The channels and conversations you see depend on your connected accounts and their messaging capabilities.</p>
                <p className="text-muted-foreground leading-relaxed">Keeping conversations in one view can make it easier to follow up without checking each channel separately.</p>
              </section>
              <section className="space-y-4 pt-4 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">Additional tools for eligible plans</h2>
                <p className="text-muted-foreground leading-relaxed">Inbox includes Pro sections for broadcasts, sequences and automations. These tools are intended to support broader outreach and follow-up alongside individual conversations.</p>
                <p className="text-muted-foreground leading-relaxed">Access depends on your plan, and available actions can vary by connected channel. Check your dashboard for the options available to your account.</p>
              </section>
              <section className="space-y-4 pt-4 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">Dashboard today, standalone in the future</h2>
                <p className="text-muted-foreground leading-relaxed">Inbox is currently part of the CityWide dashboard. A standalone app is planned for businesses that want to use Inbox on its own or alongside the CityWide suite. Standalone access is not available yet.</p>
                <Link to="/dashboard/inbox" className="inline-block text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">Open dashboard Inbox →</Link>
              </section>
              <section className="space-y-4 pt-4 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground">Frequently asked questions</h2>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem value={`faq-${index}`} key={faq.question}>
                      <AccordionTrigger className="text-left text-foreground">{faq.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            </div>
          </article>
        </div>
      </section>
      <GlassCTA kicker="Next / Get started" />
    </Layout>
  );
}
