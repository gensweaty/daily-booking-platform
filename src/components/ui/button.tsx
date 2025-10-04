
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"
import { GeorgianAuthText } from "../shared/GeorgianAuthText"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transform hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        purple: "bg-gradient-to-r from-[#9b87f5] to-[#f97316] text-white hover:from-[#8a76e4] hover:to-[#ea580c] shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-0 before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 animate-ultra-slow-gentle-signup-glow",
        green: "bg-gradient-to-r from-[#4ade80] to-[#86efac] text-white hover:from-[#22c55e] hover:to-[#6ee7b7] shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-0 before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100",
        orange: "bg-gradient-to-r from-[#f97316] to-[#fb923c] text-white hover:from-[#ea580c] hover:to-[#f97316] shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-0 before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100",
        success: "bg-[#10b981] text-white hover:bg-[#059669]",
        info: "bg-[#3b82f6] text-white hover:bg-[#2563eb]",
        warning: "bg-[#f59e0b] text-white hover:bg-[#d97706]",
        // Enhanced approve variant with gradient and animations
        approve: "bg-gradient-to-r from-[#10b981] to-[#34d399] text-white hover:from-[#059669] hover:to-[#10b981] shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-green-500/20 before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100",
        // Ultra toned down dynamic variant for action buttons - 3x less intense
        dynamic: "bg-gradient-to-r from-primary/70 via-primary/75 to-primary/70 text-primary-foreground shadow-sm hover:shadow-md transform hover:-translate-y-0.5 hover:scale-[1.005] transition-all duration-1500 ease-out border-0 before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/2 before:via-white/3 before:to-white/2 before:opacity-0 before:transition-opacity before:duration-1500 hover:before:opacity-100 after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/1 after:to-transparent after:translate-x-[-100%] after:transition-transform after:duration-3000 hover:after:translate-x-[100%]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
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
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const { language, t } = useLanguage();
    const isGeorgian = language === 'ka';
    
    const Component = asChild ? Slot : "button"
    
    // For Georgian text, we need special handling
    let wrappedChildren = children;
    
    // For button text that needs translation
    if (isGeorgian && typeof children === 'string') {
      // Special case for common button labels that need translation
      if (children === 'add' || children === 'Add') {
        wrappedChildren = (
          <GeorgianAuthText fontWeight={props.disabled ? 'normal' : 'bold'}>
            დამატება
          </GeorgianAuthText>
        );
      } else if (children === 'update' || children === 'Update') {
        wrappedChildren = (
          <GeorgianAuthText fontWeight={props.disabled ? 'normal' : 'bold'}>
            განახლება
          </GeorgianAuthText>
        );
      } else {
        // General case for other text
        wrappedChildren = (
          <GeorgianAuthText fontWeight={props.disabled ? 'normal' : 'bold'}>
            {children}
          </GeorgianAuthText>
        );
      }
    }
    
    return (
      <Component
        className={cn(
          buttonVariants({ variant, size, className }),
          isGeorgian ? "ka-text georgian-text-fix" : "",
          // Add GPU optimization for animated buttons
          (variant === "purple" || variant === "dynamic") ? "gpu-layer will-animate" : ""
        )}
        ref={ref}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">
          {wrappedChildren}
        </span>
      </Component>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
