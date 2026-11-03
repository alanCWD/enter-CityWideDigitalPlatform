import { FormEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const OWNER_EMAIL = "alan@citywidedigital.ca";

const BUSINESS_TYPES = [
  "Restaurant / Food & Beverage",
  "Contractor / Home Services",
  "Retail Store",
  "Healthcare / Medical",
  "Salon / Spa / Beauty",
  "Auto Services",
  "Professional Services",
  "Other",
];

export interface TrialPlan {
  name: string;
  planKey: string;
  price: string;
  period: string;
  tagline: string;
}

type FormState = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: string;
  website: string;
  gbpListing: string;
  billingContact: string;
  billingEmail: string;
  billingAddress1: string;
  billingCity: string;
  billingRegion: string;
  billingPostal: string;
  billingCountry: string;
  gbpConsent: boolean;
  termsConsent: boolean;
  companyWebsite: string;
};

const EMPTY: FormState = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  businessType: "",
  website: "",
  gbpListing: "",
  billingContact: "",
  billingEmail: "",
  billingAddress1: "",
  billingCity: "",
  billingRegion: "",
  billingPostal: "",
  billingCountry: "Canada",
  gbpConsent: false,
  termsConsent: false,
  companyWebsite: "",
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}

const fieldClass =
  "w-full mt-1.5 bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/20";

function Field({
  id,
  label,
  error,
  optional,
  required = true,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}{" "}
        {optional ? (
          <span className="text-muted-foreground font-normal">(optional)</span>
        ) : required ? (
          <span className="text-primary">*</span>
        ) : null}
      </Label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function TrialIntake({
  plans,
  plan,
  onPlanChange,
}: {
  plans: TrialPlan[];
  plan: string;
  onPlanChange: (plan: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ trialEndsAt: string | null; plan: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  function validate(state: FormState) {
    const next: Record<string, string> = {};
    if (!plan) next.plan = "Choose a plan.";
    if (!state.businessName.trim()) next.businessName = "Business name is required.";
    if (!state.contactName.trim()) next.contactName = "Contact name is required.";
    if (!isEmail(state.email.trim())) next.email = "Enter a valid email address.";
    if (!state.phone.trim()) next.phone = "Phone number is required.";
    if (!state.gbpListing.trim()) next.gbpListing = "Your Google Business Profile name or link is required.";
    if (!state.billingContact.trim()) next.billingContact = "Billing contact is required.";
    if (!isEmail(state.billingEmail.trim())) next.billingEmail = "Enter a valid billing email address.";
    if (!state.billingAddress1.trim()) next.billingAddress1 = "Billing address is required.";
    if (!state.billingCity.trim()) next.billingCity = "City is required.";
    if (!state.billingRegion.trim()) next.billingRegion = "Province or state is required.";
    if (!state.billingPostal.trim()) next.billingPostal = "Postal or ZIP code is required.";
    if (!state.gbpConsent) next.gbpConsent = "Authorize Owner access to continue.";
    if (!state.termsConsent) next.termsConsent = "Accept the terms to continue.";
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBanner(null);
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const firstKey = Object.keys(found)[0];
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement | null)?.focus?.({ preventScroll: true });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/trial-intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ ...form, plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data?.fields) setErrors(data.fields as Record<string, string>);
        setBanner(
          (data?.error as string) ||
            "We couldn't save your trial request. Please try again, or email " + OWNER_EMAIL + ".",
        );
        return;
      }
      setSuccess({ trialEndsAt: data.trialEndsAt ?? null, plan });
      setErrors({});
    } catch {
      setBanner(
        "We couldn't reach the server. Check your connection and try again, or email " + OWNER_EMAIL + ".",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const trialEndLabel = success?.trialEndsAt ? formatDate(success.trialEndsAt) : null;
  const successPlan = plans.find((p) => p.planKey === success?.plan);

  return (
    <section id="start-trial" className="py-20 section-alt scroll-mt-28">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-14 items-start">
          {/* Explanation column */}
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Start free trial</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground leading-tight mb-4">
              Tell us about your business.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              No credit card. We ask for your customer and billing details now so your account and first
              invoice are ready the moment your trial ends. Plan prices are in CAD, plus GST.
            </p>

            <ul className="space-y-5 mb-8">
              {[
                {
                  icon: CreditCard,
                  title: "No card today",
                  body: "Nothing is charged at signup, and we don't collect card details.",
                },
                {
                  icon: Clock,
                  title: "30 days free",
                  body: "Your trial starts when we set up your account, not when you send this form.",
                },
                {
                  icon: Lock,
                  title: "Then Stripe or Direct Deposit",
                  body: "After 30 days you pay the plan price plus GST, by card through Stripe or by Direct Deposit. Our team confirms your choice before the trial ends.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl border border-border bg-card p-6 card-shadow">
              <div className="flex items-center gap-2.5 mb-3">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                <h3 className="text-sm font-bold text-foreground">Google Business Profile access</h3>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                To keep your listing accurate, CityWide Digital manages your Google Business Profile as an{" "}
                <strong className="text-foreground font-semibold">Owner</strong>. That is management access —
                not Primary Ownership of the listing.
              </p>
              <ul className="space-y-2.5 mb-4">
                {[
                  "Owner access lets us adjust your business information, and only with your prior consent.",
                  "It can be disconnected at any time, by you or by us.",
                  "It does not transfer ownership of the listing or your Google account.",
                ].map((line) => (
                  <li key={line} className="flex gap-2.5 text-[13px] text-foreground/80 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                Owner on this request:{" "}
                <a href={`mailto:${OWNER_EMAIL}`} className="font-semibold text-primary hover:underline">
                  {OWNER_EMAIL}
                </a>
              </p>
            </div>
          </div>

          {/* Form / confirmation column */}
          {success ? (
            <div className="rounded-2xl border border-border bg-card p-8 card-shadow">
              <div className="w-14 h-14 rounded-full bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center mb-5">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-foreground mb-2">Your free trial is in.</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {successPlan ? (
                  <>
                    We've recorded your <strong className="text-foreground">{successPlan.name}</strong> trial request
                    {trialEndLabel ? (
                      <>
                        {" "}for <strong className="text-foreground">{trialEndLabel}</strong>
                      </>
                    ) : null}
                    . A team member will be in touch within one business day.
                  </>
                ) : (
                  "A team member will be in touch within one business day."
                )}
              </p>

              <div className="space-y-4 mb-6">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-xs font-bold text-foreground mb-1">Next: grant Owner access</p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    In your Google Business Profile, open Users and add{" "}
                    <strong className="text-foreground font-semibold">{OWNER_EMAIL}</strong> as an Owner. Owner is
                    management access, not Primary Ownership — you can disconnect it at any time, and we only adjust
                    your information with your prior consent.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-xs font-bold text-foreground mb-1">Payment after 30 days</p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {successPlan ? `${successPlan.name} is ${successPlan.price}${successPlan.period} plus GST. ` : ""}
                    You'll pay by credit card through Stripe, or by Direct Deposit. No card was collected today and
                    nothing is charged until the method is confirmed with you.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="default" asChild className="sm:flex-1">
                  <a href={`mailto:${OWNER_EMAIL}`}>
                    <Mail className="w-4 h-4" />
                    Email our team
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="sm:flex-1"
                  onClick={() => {
                    setSuccess(null);
                    setForm(EMPTY);
                    onPlanChange(plans[0]?.planKey ?? "");
                  }}
                >
                  Start another request
                </Button>
              </div>
            </div>
          ) : (
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              noValidate
              className="rounded-2xl border border-border bg-card p-6 sm:p-8 card-shadow"
            >
              {banner && (
                <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/8 p-3.5 mb-6">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[13px] text-destructive leading-relaxed">{banner}</p>
                </div>
              )}

              {/* Plan */}
              <fieldset data-field="plan">
                <legend className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Choose your plan
                </legend>
                <div className="grid sm:grid-cols-3 gap-2.5 mb-2">
                  {plans.map((option) => {
                    const active = option.planKey === plan;
                    return (
                      <button
                        key={option.planKey}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onPlanChange(option.planKey)}
                        className={cn(
                          "rounded-xl border-2 px-3 py-3 text-left transition-all",
                          active
                            ? "border-primary bg-accent/60 shadow-[0_2px_10px_rgba(0,120,215,0.15)]"
                            : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {option.name}
                        </span>
                        <span className="block text-lg font-extrabold text-foreground leading-tight mt-0.5">
                          {option.price}
                          <span className="text-[11px] font-medium text-muted-foreground">{option.period}</span>
                          <span className="block text-[10px] font-medium text-muted-foreground/80 mt-0.5">+ GST</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.plan && (
                  <p className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-destructive">
                    <AlertCircle className="w-3 h-3" /> {errors.plan}
                  </p>
                )}
              </fieldset>

              {/* Customer details */}
              <div className="pt-6 mt-6 border-t border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Customer details</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2" data-field="businessName">
                    <Field id="businessName" label="Business name" error={errors.businessName}>
                      <Input
                        id="businessName"
                        value={form.businessName}
                        onChange={(e) => set("businessName", e.target.value)}
                        placeholder="e.g. Luigi's NY Pizza"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div data-field="contactName">
                    <Field id="contactName" label="Your full name" error={errors.contactName}>
                      <Input
                        id="contactName"
                        value={form.contactName}
                        onChange={(e) => set("contactName", e.target.value)}
                        placeholder="Jane Smith"
                        autoComplete="name"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div data-field="phone">
                    <Field id="phone" label="Phone" error={errors.phone}>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder="250-555-0123"
                        autoComplete="tel"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div data-field="email">
                    <Field id="email" label="Email" error={errors.email}>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email", e.target.value)}
                        placeholder="you@yourbusiness.com"
                        autoComplete="email"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div>
                    <Field id="businessType" label="Business type" optional>
                      <select
                        id="businessType"
                        value={form.businessType}
                        onChange={(e) => set("businessType", e.target.value)}
                        className={cn(fieldClass, "h-[42px]")}
                      >
                        <option value="">Select an industry</option>
                        {BUSINESS_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field
                      id="website"
                      label="Current website (enter your social media account if no website)"
                      required={false}
                    >
                      <Input
                        id="website"
                        value={form.website}
                        onChange={(e) => set("website", e.target.value)}
                        placeholder="https://yourbusiness.com or @yourbusiness"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2" data-field="gbpListing">
                    <Field
                      id="gbpListing"
                      label="Google Business Profile"
                      error={errors.gbpListing}
                    >
                      <Input
                        id="gbpListing"
                        value={form.gbpListing}
                        onChange={(e) => set("gbpListing", e.target.value)}
                        placeholder="Business name on Google, or a maps link"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Billing details */}
              <div className="pt-6 mt-6 border-t border-border">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Billing details</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Required now so your invoice is ready after the trial. No card is collected.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div data-field="billingContact">
                    <Field id="billingContact" label="Billing contact" error={errors.billingContact}>
                      <Input
                        id="billingContact"
                        value={form.billingContact}
                        onChange={(e) => set("billingContact", e.target.value)}
                        placeholder="Name on the invoice"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div data-field="billingEmail">
                    <Field id="billingEmail" label="Billing email" error={errors.billingEmail}>
                      <Input
                        id="billingEmail"
                        type="email"
                        value={form.billingEmail}
                        onChange={(e) => set("billingEmail", e.target.value)}
                        placeholder="billing@yourbusiness.com"
                        autoComplete="email"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2" data-field="billingAddress1">
                    <Field id="billingAddress1" label="Address" error={errors.billingAddress1}>
                      <Input
                        id="billingAddress1"
                        value={form.billingAddress1}
                        onChange={(e) => set("billingAddress1", e.target.value)}
                        placeholder="Street address"
                        autoComplete="street-address"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div data-field="billingCity">
                    <Field id="billingCity" label="City" error={errors.billingCity}>
                      <Input
                        id="billingCity"
                        value={form.billingCity}
                        onChange={(e) => set("billingCity", e.target.value)}
                        placeholder="Victoria"
                        autoComplete="address-level2"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div data-field="billingRegion">
                    <Field id="billingRegion" label="Province / State" error={errors.billingRegion}>
                      <Input
                        id="billingRegion"
                        value={form.billingRegion}
                        onChange={(e) => set("billingRegion", e.target.value)}
                        placeholder="BC"
                        autoComplete="address-level1"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div data-field="billingPostal">
                    <Field id="billingPostal" label="Postal / ZIP code" error={errors.billingPostal}>
                      <Input
                        id="billingPostal"
                        value={form.billingPostal}
                        onChange={(e) => set("billingPostal", e.target.value)}
                        placeholder="V8T 2W1"
                        autoComplete="postal-code"
                        className="mt-1.5"
                      />
                    </Field>
                  </div>
                  <div>
                    <Field id="billingCountry" label="Country">
                      <select
                        id="billingCountry"
                        value={form.billingCountry}
                        onChange={(e) => set("billingCountry", e.target.value)}
                        className={cn(fieldClass, "h-[42px]")}
                      >
                        <option value="Canada">Canada</option>
                        <option value="United States">United States</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Consents */}
              <div className="pt-6 mt-6 border-t border-border space-y-4">
                <div data-field="gbpConsent">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="gbpConsent"
                      checked={form.gbpConsent}
                      onCheckedChange={(v) => set("gbpConsent", v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="gbpConsent" className="text-[13px] leading-relaxed font-normal text-foreground/85 cursor-pointer">
                      I authorize CityWide Digital ({OWNER_EMAIL}) as an{" "}
                      <strong className="font-semibold text-foreground">Owner</strong> of this Google Business
                      Profile. I understand this is management access, not Primary Ownership, that it can be
                      disconnected at any time, and that my information is only adjusted with my prior consent.
                    </Label>
                  </div>
                  {errors.gbpConsent && (
                    <p className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-destructive">
                      <AlertCircle className="w-3 h-3" /> {errors.gbpConsent}
                    </p>
                  )}
                </div>
                <div data-field="termsConsent">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="termsConsent"
                      checked={form.termsConsent}
                      onCheckedChange={(v) => set("termsConsent", v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="termsConsent" className="text-[13px] leading-relaxed font-normal text-foreground/85 cursor-pointer">
                      I agree to the{" "}
                      <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
                      and{" "}
                      <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </Label>
                  </div>
                  {errors.termsConsent && (
                    <p className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-destructive">
                      <AlertCircle className="w-3 h-3" /> {errors.termsConsent}
                    </p>
                  )}
                </div>
                {/* Honeypot */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="companyWebsite">Company website</label>
                  <input
                    id="companyWebsite"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.companyWebsite}
                    onChange={(e) => set("companyWebsite", e.target.value)}
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full mt-6" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting your trial…
                  </>
                ) : (
                  <>
                    Start my 30-day trial
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-3 text-center">
                <ShieldQuestion className="w-3.5 h-3.5" />
                No credit card required. No charge during the trial.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
