import { useState } from "react";
import { Mail, Phone, MapPin, Calendar, Send, CheckCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const OWNER_EMAIL = "alan@citywidedigital.ca";

const businessTypes = [
  "Restaurant / Food & Beverage",
  "Contractor / Home Services",
  "Retail Store",
  "Healthcare / Medical",
  "Salon / Spa / Beauty",
  "Auto Services",
  "Professional Services",
  "Other",
];

const details = [
  { icon: Mail, label: "Email", value: "alan@citywidedigital.ca", href: "mailto:alan@citywidedigital.ca" },
  { icon: Phone, label: "Phone", value: "250-882-7378", href: "tel:+12508827378" },
  { icon: MapPin, label: "Location", value: "Serving businesses nationwide", href: null },
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", business: "", email: "", phone: "", type: "", message: "", website: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/contact-intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(
          (data?.error as string) ||
            `We couldn't send your message. Please try again, or email ${OWNER_EMAIL}.`,
        );
        return;
      }
      setSubmitted(true);
    } catch {
      setError(
        `We couldn't reach the server. Check your connection and try again, or email ${OWNER_EMAIL}.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout variant="glass">
      <GlassHero
        kicker="05 / Contact"
        title="Let's talk about your business"
        lede="Book a free 20-minute discovery call or send us a message. We typically respond within one business day."
      />

      <section className="gp-section">
        <div className="gp-shell">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
            {/* Info column */}
            <div className="space-y-6">
              <div className="gp-panel p-7">
                <p className="gp-kicker">Direct lines</p>
                <div className="mt-6 space-y-5">
                  {details.map(({ icon: Icon, label, value, href }) => (
                    <div key={label} className="flex items-start gap-3.5">
                      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.06]">
                        <Icon className="h-4 w-4 text-[var(--gp-ice)]" strokeWidth={1.5} />
                      </span>
                      <div>
                        <div className="gp-kicker mb-1">{label}</div>
                        {href ? (
                          <a href={href} className="gp-link text-sm font-light">
                            {value}
                          </a>
                        ) : (
                          <span className="text-sm font-light text-[var(--gp-ink)]">{value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 border-t border-white/10 pt-5">
                  <div className="gp-kicker mb-2">Support hours</div>
                  <p className="text-sm font-light text-[var(--gp-ink-72)]">Mon–Fri: 9am – 6pm PST</p>
                  <p className="text-sm font-light text-[var(--gp-ink-72)]">Sun: Closed</p>
                </div>
              </div>

              <div className="gp-panel gp-panel--feature p-7">
                <Calendar className="h-6 w-6 text-[var(--gp-ice)]" strokeWidth={1.5} />
                <h3 className="gp-display mt-4 text-2xl">Prefer to talk live?</h3>
                <p className="gp-body mt-3 text-sm">
                  Book a free 20-minute discovery call with our team. We'll learn about your business and show you
                  exactly how CityWide Digital can help.
                </p>
                <a
                  href="https://calendly.com/alan-citywidedigital/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gp-btn mt-6 w-full"
                >
                  Book a discovery call
                </a>
              </div>
            </div>

            {/* Form column */}
            <div>
              {submitted ? (
                <div className="gp-panel flex h-full flex-col items-center justify-center p-12 text-center">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-[#7ee7c8]/30 bg-[#7ee7c8]/12">
                    <CheckCircle className="h-6 w-6 text-[#7ee7c8]" strokeWidth={1.5} />
                  </div>
                  <h3 className="gp-display text-2xl">Message received</h3>
                  <p className="gp-body mt-3 max-w-sm text-sm">
                    Thanks for reaching out. A member of our team will get back to you within one business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="gp-panel space-y-5 p-7 md:p-9">
                  <div>
                    <p className="gp-kicker">Send a message</p>
                    <h3 className="gp-display mt-3 text-2xl">Tell us what you need</h3>
                  </div>

                  <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                    <label htmlFor="website">Website</label>
                    <input
                      id="website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="gp-kicker">Full name *</Label>
                      <Input
                        id="name"
                        placeholder="Jane Smith"
                        required
                        className="h-11 rounded-xl"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="business" className="gp-kicker">Business name *</Label>
                      <Input
                        id="business"
                        placeholder="Jane's Bakery"
                        required
                        className="h-11 rounded-xl"
                        value={form.business}
                        onChange={(e) => setForm({ ...form, business: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="gp-kicker">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jane@yourbusiness.com"
                        required
                        className="h-11 rounded-xl"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="gp-kicker">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 000-0000"
                        className="h-11 rounded-xl"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="type" className="gp-kicker">Business type</Label>
                    <select
                      id="type"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="h-11 w-full rounded-xl px-4 text-sm transition-all"
                    >
                      <option value="">Select your industry...</option>
                      {businessTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="gp-kicker">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us about your business and what you're looking for..."
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="resize-none rounded-xl"
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-light text-destructive"
                    >
                      {error}
                    </div>
                  )}

                  <Button type="submit" size="lg" className="gp-submit w-full" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Message"}
                    <Send className="h-4 w-4" />
                  </Button>

                  <p className="text-center text-[11px] font-light text-[var(--gp-ink-38)]">
                    By submitting, you agree to our Privacy Policy. We never share your data.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
