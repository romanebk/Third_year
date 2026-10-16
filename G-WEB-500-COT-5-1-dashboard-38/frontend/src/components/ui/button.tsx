import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Retour tactile façon touche iOS : le bouton s'enfonce légèrement au clic
// (active:scale) et son ombre s'aplatit en même temps — on garde la forme
// pilule déjà en place (cf. PR a11y de Rayann'), on ajoute juste la sensation
// de pression. transform (pas transition-colors seul) pour que le scale anime
// aussi ; prefers-reduced-motion neutralise déjà toute transition (globals.css).
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-[transform,box-shadow,background-color,color,opacity] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 min-h-[44px] min-w-[44px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.5),0_6px_16px_-4px_rgba(0,0,0,0.6)] hover:bg-primary/90 hover:shadow-[0_1px_2px_rgba(0,0,0,0.5),0_8px_20px_-4px_rgba(0,0,0,0.65)] active:shadow-[0_1px_1px_rgba(0,0,0,0.5)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(0,0,0,0.4),0_6px_16px_-4px_rgba(248,113,113,0.35)] hover:bg-destructive/90 active:shadow-[0_1px_1px_rgba(0,0,0,0.4)]",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.35)] hover:bg-secondary/80 active:shadow-none",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/70",
        link: "text-primary underline-offset-4 hover:underline min-h-0 min-w-0 active:scale-100",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-10 px-4",
        lg: "h-12 px-7",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };