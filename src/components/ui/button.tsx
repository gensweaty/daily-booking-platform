
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"
import { GeorgianAuthText } from "../shared/GeorgianAuthText"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        purple: "bg-[#9b87f5] text-white hover:bg-[#8a76e4]",
        green: "bg-[#4ade80] text-white hover:bg-[#22c55e]",
        orange: "bg-[#f97316] text-white hover:bg-[#ea580c]",
        success: "bg-[#10b981] text-white hover:bg-[#059669]",
        info: "bg-[#3b82f6] text-white hover:bg-[#2563eb]",
        warning: "bg-[#f59e0b] text-white hover:bg-[#d97706]",
        // Approve variant with proper styling
        approve: "bg-[#10b981] text-white hover:bg-[#059669] border-green-500",
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
          isGeorgian ? "ka-text georgian-text-fix" : ""
        )}
        ref={ref}
        {...props}
      >
        {wrappedChildren}
      </Component>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
