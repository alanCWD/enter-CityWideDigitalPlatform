import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,120,215,0.28)] hover:bg-[#00447A] hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(0,120,215,0.38)] active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-2 border-primary bg-transparent text-primary hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        "ghost-dark":
          "text-[rgba(238,241,250,0.75)] hover:text-[#EEF1FA] hover:bg-white/10 border border-white/20",
        link:
          "text-primary underline-offset-4 hover:underline",
        cta:
          "bg-cta-gradient bg-[linear-gradient(90deg,#00447A_0%,#0078D7_100%)] text-white shadow-[0_2px_8px_rgba(0,120,215,0.32)] hover:opacity-90 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,120,215,0.42)] active:scale-[0.98]",
        "on-dark":
          "bg-primary text-white shadow-[0_2px_8px_rgba(0,0,0,0.24)] hover:bg-[#00447A] hover:-translate-y-px active:scale-[0.98]",
        nav:
          "bg-primary text-white text-xs px-4 py-1.5 h-auto shadow-[0_1px_4px_rgba(0,120,215,0.3)] hover:bg-[#00447A] active:scale-[0.98]",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-md px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
