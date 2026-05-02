import { cn } from "@/lib/utils";

interface LogoProps {
  /** Visual size variant. Controls the rendered height of the logo image. */
  size?: "xs" | "sm" | "md" | "lg";
  /** Tailwind classes for additional styling (margin, opacity, etc.). */
  className?: string;
}

const HEIGHTS: Record<NonNullable<LogoProps["size"]>, string> = {
  xs: "h-5",
  sm: "h-6",
  md: "h-8",
  lg: "h-12",
};

/**
 * Official CityWide Digital wordmark.
 *
 * The logo file lives in /public/cwd-logo.png (orange "DIGITAL" + navy "CityWide").
 * For dark backgrounds we tint the image via a CSS filter so the navy stays legible.
 */
export function Logo({ size = "md", className }: LogoProps) {
  return (
    <img
      src="/cwd-logo.png"
      alt="CityWide Digital"
      className={cn(HEIGHTS[size], "w-auto select-none", className)}
      draggable={false}
    />
  );
}

/**
 * Variant tuned for dark surfaces: brightens the navy strokes so they read
 * clearly against the deep-blue dashboard / portal backgrounds.
 */
export function LogoOnDark({ size = "md", className }: LogoProps) {
  return (
    <img
      src="/cwd-logo.png"
      alt="CityWide Digital"
      className={cn(
        HEIGHTS[size],
        "w-auto select-none",
        // Raise the navy text out of the dark background with a controlled brightness boost.
        "[filter:brightness(1.6)_saturate(1.1)]",
        className,
      )}
      draggable={false}
    />
  );
}
