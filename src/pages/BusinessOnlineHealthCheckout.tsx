import { AlertCircle, ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";

export default function BusinessOnlineHealthCheckout() {
  const [params] = useSearchParams();
  const refs = params.getAll("boh_ref");
  const hasValidReference = refs.length === 1 && /^[A-Za-z0-9_-]{1,128}$/.test(refs[0]);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <a href="https://online-health.citywidedigital.ca/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Online Health
        </a>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Business Online Health</p>
            <h1 className="mt-5 max-w-xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Get the full picture of your business online.</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">Go beyond your free snapshot with an expanded report for your business, purchased securely through CityWide.</p>
            <div className="mt-10 space-y-6 border-t border-border pt-8">
              <div className="flex gap-4"><FileText className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-semibold text-foreground">One business, one report</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Your purchase applies to the report you started in Business Online Health.</p></div></div>
              <div className="flex gap-4"><ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-semibold text-foreground">A one-time purchase</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">No subscription. Your payment and receipt are handled by CityWide.</p></div></div>
            </div>
          </div>
          <aside className="h-fit rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg sm:p-8" aria-label="Order summary">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Order summary</p>
            <div className="mt-6 flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Full report</h2><p className="mt-1 text-sm text-muted-foreground">One business · one-time</p></div><p className="text-2xl font-bold">$59 <span className="text-sm font-medium text-muted-foreground">USD</span></p></div>
            <div className="mt-7 border-t border-border pt-6" role="status">
              <div className="flex items-start gap-3 rounded-lg bg-muted p-4"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">{hasValidReference ? "Checkout is not available yet" : "A report reference is required"}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hasValidReference ? "Online payments are not connected for this report. You won't be charged." : "Return to your free snapshot and use its unlock button to start with a valid report reference."}</p></div></div>
              <Button className="mt-5 w-full" size="lg" disabled>Continue to checkout</Button>
              <p className="mt-4 text-center text-sm text-muted-foreground">Need help? <a className="font-medium text-primary underline underline-offset-4" href="/contact">Contact CityWide</a>.</p>
            </div>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
