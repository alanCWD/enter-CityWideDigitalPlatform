import { ReactNode } from "react";
import { OrbitHeroScene } from "./OrbitHeroScene";

interface GlassHeroProps {
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  /** Optional row of actions or chips rendered under the lede. */
  children?: ReactNode;
  align?: "left" | "center";
  /** Extra classes for the display heading size. */
  titleClassName?: string;
  /** Renders the live orbit scene behind the hero. */
  scene?: boolean;
}

export function GlassHero({
  kicker,
  title,
  lede,
  children,
  align = "left",
  titleClassName = "text-[clamp(2.2rem,5.4vw,4.2rem)]",
  scene = false,
}: GlassHeroProps) {
  const centered = align === "center";

  return (
    <header className={`gp-hero${scene ? " gp-hero--scene" : ""}`}>
      {scene && <OrbitHeroScene />}

      <div className="gp-shell">
        <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
          <p className="gp-kicker">{kicker}</p>
          <h1 className={`gp-display mt-5 ${titleClassName}`}>{title}</h1>
          {lede && <p className="gp-lede mt-6 text-base md:text-lg">{lede}</p>}
          {children && (
            <div className={`mt-9 flex flex-wrap items-center gap-3 ${centered ? "justify-center" : ""}`}>
              {children}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
