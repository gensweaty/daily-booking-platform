
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        purple: "border-transparent bg-[#9b87f5] text-white hover:bg-[#8a76e4]",
        green: "border-transparent bg-[#4ade80] text-white hover:bg-[#22c55e]",
        orange: "border-transparent bg-[#f97316] text-white hover:bg-[#ea580c]",
        blue: "border-transparent bg-[#3b82f6] text-white hover:bg-[#2563eb]",
        yellow: "border-transparent bg-[#f59e0b] text-white hover:bg-[#d97706]",
        pink: "border-transparent bg-[#ec4899] text-white hover:bg-[#db2777]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
