import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"
import { GeorgianAuthText } from "../shared/GeorgianAuthText"

const enhancedButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-primary-light text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        destructive: "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        outline: "border-2 border-primary/30 bg-white/50 backdrop-blur-sm hover:bg-primary/10 hover:border-primary/50 hover:shadow-md dark:bg-gray-900/50 dark:hover:bg-primary/20",
        secondary: "bg-gradient-to-r from-secondary to-secondary-light text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        ghost: "hover:bg-accent/10 hover:shadow-md transition-all duration-200",
        link: "text-primary underline-offset-4 hover:underline",
        purple: "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        green: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        orange: "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        success: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        info: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        warning: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
        approve: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-md px-4",
        lg: "h-12 rounded-lg px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof enhancedButtonVariants> {
  asChild?: boolean
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const { language } = useLanguage();
    const isGeorgian = language === 'ka';
    
    const Component = asChild ? Slot : "button"
    
    // For Georgian text, we need special handling
    let wrappedChildren = children;
    
    // For button text that needs translation
    if (isGeorgian && typeof children === 'string') {
      wrappedChildren = (
        <GeorgianAuthText fontWeight={props.disabled ? 'normal' : 'bold'}>
          {children}
        </GeorgianAuthText>
      );
    }
    
    return (
      <Component
        className={cn(
          enhancedButtonVariants({ variant, size, className }),
          isGeorgian ? "ka-text georgian-text-fix" : "",
          "before:absolute before:inset-0 before:bg-white/20 before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100"
        )}
        ref={ref}
        {...props}
      >
        {/* Ripple effect overlay */}
        <span className="absolute inset-0 overflow-hidden rounded-lg">
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:animate-[slide-in_0.6s_ease-out] opacity-0 group-hover:opacity-100" />
        </span>
        
        <span className="relative z-10 flex items-center gap-2">
          {wrappedChildren}
        </span>
      </Component>
    )
  }
)
EnhancedButton.displayName = "EnhancedButton"

export { EnhancedButton, enhancedButtonVariants }