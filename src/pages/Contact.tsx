import { useState } from "react";
import { Mail, Phone, MapPin, Calendar, Send, CheckCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "", business: "", email: "", phone: "", type: "", message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_100%)] py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Get In Touch</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#EEF1FA] mb-5 leading-tight">
            Let's talk about your business
          </h1>
          <p className="text-lg text-[rgba(238,241,250,0.7)] max-w-xl mx-auto">
            Book a free 20-minute discovery call or send us a message. We typically respond within one business day.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Info Column */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-secondary mb-4">Contact information</h2>
                <div className="space-y-4">
                  {[
                    { icon: Mail, label: "Email", value: "alan@citywidedigital.ca", href: "mailto:alan@citywidedigital.ca" },
                    { icon: Phone, label: "Phone", value: "250-882-7378", href: "tel:+12508827378" },
                    { icon: MapPin, label: "Location", value: "Serving businesses nationwide", href: null },
                  ].map(({ icon: Icon, label, value, href }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
                        {href ? (
                          <a href={href} className="text-foreground font-medium hover:text-primary transition-colors">{value}</a>
                        ) : (
                          <span className="text-foreground font-medium">{value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Book a call CTA */}
              <div className="bg-[#1B2A4A] rounded-2xl p-6 border border-white/10">
                <Calendar className="w-8 h-8 text-primary mb-3" />
                <h3 className="text-xl font-bold text-[#EEF1FA] mb-2">Prefer to talk live?</h3>
                <p className="text-sm text-[rgba(238,241,250,0.6)] mb-5 leading-relaxed">
                  Book a free 20-minute discovery call with our team. We'll learn about your business and show you exactly how CityWide Digital can help.
                </p>
                <Button variant="on-dark" className="w-full" asChild>
                  <a href="https://calendly.com" target="_blank" rel="noopener noreferrer">
                    Book a Discovery Call
                  </a>
                </Button>
              </div>

              {/* Support hours */}
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold text-foreground mb-2">Support Hours</p>
                <p>Mon–Fri: 9am – 6pm PST</p>
                <p>Sun: Closed</p>
              </div>
            </div>

            {/* Form Column */}
            <div className="lg:col-span-3">
              {submitted ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-border card-shadow">
                  <div className="w-16 h-16 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center mb-5">
                    <CheckCircle className="w-8 h-8 text-[#22C55E]" />
                  </div>
                  <h3 className="text-2xl font-bold text-secondary mb-3">Message received!</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Thanks for reaching out. A member of our team will get back to you within one business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 border border-border card-shadow space-y-5">
                  <h3 className="text-xl font-bold text-secondary mb-2">Send us a message</h3>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold">Full Name *</Label>
                      <Input
                        id="name"
                        placeholder="Jane Smith"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="business" className="text-xs font-semibold">Business Name *</Label>
                      <Input
                        id="business"
                        placeholder="Jane's Bakery"
                        required
                        value={form.business}
                        onChange={(e) => setForm({ ...form, business: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="jane@yourbusiness.com"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(555) 000-0000"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="type" className="text-xs font-semibold">Business Type</Label>
                    <select
                      id="type"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-all"
                    >
                      <option value="">Select your industry...</option>
                      {businessTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="message" className="text-xs font-semibold">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us about your business and what you're looking for..."
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="resize-none"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full">
                    Send Message
                    <Send className="w-4 h-4" />
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
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
