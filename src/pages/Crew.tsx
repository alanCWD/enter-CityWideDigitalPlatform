import { Link } from "react-router-dom";
import { Sparkles, Wrench, UtensilsCrossed, Truck, Store, ShoppingBag, CircleDot } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";
import { cn } from "@/lib/utils";

type CrewMember = {
  id: string;
  firstName: string;
  title: string;
  niche: string;
  blurb: string;
  movie: string;
  saying: string;
  /** Generated portrait. Cards fall back to a monogram until it is available. */
  portrait?: string;
  featured?: boolean;
  icon?: typeof Sparkles;
};

const coreCrew: CrewMember[] = [
  {
    id: "alan",
    portrait: "https://cdn.enter.pro/resources/projects/5831877fc23c4834938c8f0f2295f49b/ai_outputs/atomic_ab22a422-4672-460e-8f5f-8261b418a393/image_atomic_ab22a422-4672-460e-8f5f-8261b418a393_d07c9603.jpeg",
    firstName: "Alan",
    title: "Chief Technology Officer",
    niche: "Platform & product",
    blurb:
      "Runs the technology side of CityWide Digital — the sync engine that turns a Google Business Profile into a live web app, and all the apps that help your company get to a better place without the effort. The goal has never changed: a business owner should never have to think about the software.",
    movie: "Interstellar",
    saying: "Do not go gentle into that good night.",
    featured: true,
    icon: Wrench,
  },
  {
    id: "rob-at",
    portrait: "https://cdn.enter.pro/resources/uid_100027458/crew-rob-at_9cf946e9.png",
    firstName: "Rob@",
    title: "Agentic Helpbot · “Rob At”",
    niche: "First contact",
    blurb:
      "An aspiring actor with a titanium ego, he’s currently moonlighting as CityWide Digital’s chattiest chatbot until Hollywood recognizes what his last three directors called “an unmistakable presence” and “a workplace concern.” As the first voice to greet you at CityWide Digital, he figures out what you need, matches you with the right team member, books the right demo, and hands the crew a clear brief so you don’t have to repeat yourself. Think of him as the opening act.",
    movie: "Futurama: Bender’s Big Score",
    saying: "Bite my shiny metal chassis.",
    featured: true,
    icon: Sparkles,
  },
];

const nicheCrew: CrewMember[] = [
  {
    id: "restaurants",
    firstName: "Nadia",
    portrait: "https://cdn.enter.pro/resources/uid_100027458/crew-nadia_ff0619ea.png",
    title: "Restaurant Lead",
    niche: "Restaurants",
    blurb:
      "Has worked both sides of the pass. Spends her time on menus Google can actually read, demand for the right nights, and the reviews that decide where a Friday booking lands.",
    movie: "Alien",
    saying: "In space, no one can hear you scream.",
    icon: UtensilsCrossed,
  },
  {
    id: "service",
    firstName: "Owen",
    portrait: "https://cdn.enter.pro/resources/uid_100027458/crew-owen_9c1350db.png",
    title: "Service & Trades Lead",
    niche: "Service companies",
    blurb:
      "Lives in the world of quotes, callbacks and seasonality. Builds lead flow for contractors and trades: one accurate profile, honest service areas, and a phone that rings from the right searches.",
    movie: "Star Trek: The Next Generation",
    saying: "Make it so.",
    icon: Wrench,
  },
  {
    id: "wholesale",
    firstName: "Priya",
    portrait: "https://cdn.enter.pro/resources/uid_100027458/crew-priya_60840578.png",
    title: "Wholesale Lead",
    niche: "Wholesale",
    blurb:
      "Turns catalogues into something buyers and search engines both understand. Fluent in minimum orders, spec sheets and the customer who finds you at eleven at night holding a part number.",
    movie: "2001: A Space Odyssey",
    saying: "I’m sorry, Dave. I’m afraid I can’t do that.",
    icon: Truck,
  },
  {
    id: "retail",
    firstName: "Cole",
    portrait: "https://cdn.enter.pro/resources/uid_100027458/crew-cole_ac684bb1.png",
    title: "Retail Lead",
    niche: "Retail",
    blurb:
      "Keeps storefronts findable — hours, holiday closures, in-store offers, and stock that shows up in the right place. A local shop usually loses customers long before anyone reaches the door.",
    movie: "Apollo 13",
    saying: "Failure is not an option.",
    icon: Store,
  },
  {
    id: "ecommerce",
    firstName: "Sam",
    portrait: "https://cdn.enter.pro/resources/uid_100027458/crew-sam_88593dbb.png",
    title: "eCommerce Lead",
    niche: "eCommerce",
    blurb:
      "Connects catalogue, feed and ad spend so one product never reads three different ways. Fixes the unglamorous parts — feed errors, shipping promises, tracking — that quietly cost sales.",
    movie: "The Martian",
    saying: "Work the problem.",
    icon: ShoppingBag,
  },
];

function Portrait({ member, priority = false }: { member: CrewMember; priority?: boolean }) {
  const Icon = member.icon ?? CircleDot;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(110,168,255,0.22),rgba(255,255,255,0.03)_55%,rgba(5,7,10,0.9))]" />
      {member.portrait ? (
        <img
          src={member.portrait}
          alt={`${member.firstName}, ${member.title}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="relative h-full w-full object-cover object-top transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-3">
          <Icon className="h-7 w-7 text-[var(--gp-ice)]" strokeWidth={1.25} />
          <span className="gp-mono text-[11px] text-[var(--gp-ink-55)]">{member.firstName}</span>
        </div>
      )}
    </div>
  );
}

function Favourite({ member }: { member: CrewMember }) {
  return (
    <dl className="mt-5 space-y-2.5 border-t border-[var(--gp-line-soft)] pt-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <dt className="gp-mono text-[10px] text-[var(--gp-ink-38)]">Favourite movie</dt>
        <dd className="text-[12.5px] font-light text-[var(--gp-ink-72)]">{member.movie}</dd>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <dt className="gp-mono text-[10px] text-[var(--gp-ink-38)]">Favourite saying</dt>
        <dd className="text-[12.5px] font-light italic text-[var(--gp-ice)]">“{member.saying}”</dd>
      </div>
    </dl>
  );
}

function FeaturedCard({ member }: { member: CrewMember }) {
  return (
    <article className="gp-panel gp-panel--hover group grid overflow-hidden sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
      <div className="relative aspect-[4/5] sm:aspect-auto sm:min-h-[340px]">
        <Portrait member={member} priority />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,7,10,0.82),transparent_55%)]"
        />
      </div>

      <div className="relative flex flex-col justify-between p-6 md:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="gp-kicker">{member.niche}</p>
          </div>
          <h3 className="gp-display mt-3 text-[clamp(1.6rem,3vw,2.1rem)]">{member.firstName}</h3>
          <p className="mt-1 text-[13px] font-light tracking-wide text-[var(--gp-blue)]">{member.title}</p>
          <p className="gp-body mt-4 text-[13.5px]">{member.blurb}</p>
        </div>
        <Favourite member={member} />
      </div>
    </article>
  );
}

function NicheCard({ member }: { member: CrewMember }) {
  const Icon = member.icon ?? CircleDot;

  return (
    <article className="gp-panel gp-panel--soft gp-panel--hover group flex flex-col overflow-hidden">
      <div className="relative aspect-[4/5]">
        <Portrait member={member} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#05070a_2%,rgba(5,7,10,0.55)_26%,transparent_62%)]"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
          <div>
            <p className="gp-mono text-[10px] text-[var(--gp-ice)]">{member.niche}</p>
            <h3 className="gp-display mt-1 text-[1.7rem] leading-none">{member.firstName}</h3>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--gp-line)] bg-[#05070a]/60 backdrop-blur-sm">
            <Icon className="h-4 w-4 text-[var(--gp-ice)]" strokeWidth={1.4} />
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <p className="text-[12px] font-light tracking-wide text-[var(--gp-blue)]">{member.title}</p>
        <p className="gp-body mt-3 text-[13px]">{member.blurb}</p>
        <div className="mt-auto">
          <Favourite member={member} />
        </div>
      </div>
    </article>
  );
}

export default function Crew() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="01 / The crew"
        scene
        title="Small core. Deep bench."
        lede="CityWide Digital is one platform run by a small core team specializing in every kind of local business — and one extremely confident helpbot who answers first."
      />

      <section className="gp-section">
        <div className="gp-shell">
          <div className="mb-12 max-w-2xl">
            <p className="gp-kicker">02 / Mission leads</p>
            <h2 className="gp-display mt-4 text-[clamp(1.7rem,3.4vw,2.6rem)]">The people who work the platform</h2>
            <p className="gp-lede mt-4">
              The team who builds it, and one built to answer the inquiry at two in the morning.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {coreCrew.map((member) => (
              <FeaturedCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      </section>

      <section className="gp-section">
        <div className="gp-shell">
          <div className="mb-12 max-w-2xl">
            <p className="gp-kicker">03 / Niche crew</p>
            <h2 className="gp-display mt-4 text-[clamp(1.7rem,3.4vw,2.6rem)]">A specialist for your industry</h2>
            <p className="gp-lede mt-4">
              Restaurants, trades, wholesale, retail and online sellers each get someone who already knows the
              vocabulary — and the parts of the job that never make it into a marketing brochure.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {nicheCrew.map((member) => (
              <NicheCard key={member.id} member={member} />
            ))}

            <div className="gp-panel gp-panel--soft flex flex-col justify-between p-6 md:p-8">
              <div>
                <p className="gp-kicker">Your niche</p>
                <h3 className="gp-display mt-3 text-[1.7rem] leading-tight">Not on the list?</h3>
                <p className="gp-body mt-3 text-[13px]">
                  Salons, auto, professional services, hospitality groups — the bench grows with the platform. Tell us
                  what you run and we will point you at the closest specialist.
                </p>
              </div>
              <Link
                to="/contact"
                className="mt-6 inline-flex items-center gap-2 text-[13px] font-light text-[var(--gp-ice)] transition-colors hover:text-[var(--gp-ink)]"
              >
                Ask who handles your industry
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-[var(--gp-line-soft)] bg-white/[0.03] p-5 sm:flex-row sm:items-start sm:gap-4">
            <CircleDot className="h-4 w-4 shrink-0 text-[var(--gp-blue)]" strokeWidth={1.5} />
            <p className="max-w-3xl text-[12.5px] font-light leading-relaxed text-[var(--gp-ink-55)]">
              The platform crew represent independent partner agencies working inside the CityWide Digital platform.
              You work with one platform and one invoice; each specialist brings the depth of their own market. Rob@
              is the chat assistant.
            </p>
          </div>
        </div>
      </section>

      <GlassCTA
        kicker="04 / Next"
        title="Want the specialist for your industry?"
        lede="Tell us what you run. We will introduce the right crew member and show you what the platform would do for that business."
        note="No credit card required · 30-day free trial"
      />
    </Layout>
  );
}
