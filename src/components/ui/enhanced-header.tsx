import * as React from "react"
import { cn } from "@/lib/utils"
import { LanguageText } from "@/components/shared/LanguageText"

interface EnhancedHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  variant?: "gradient" | "default" | "subtle";
  children: React.ReactNode;
}

const EnhancedHeader = React.forwardRef<HTMLHeadingElement, EnhancedHeaderProps>(
  ({ className, level = 2, variant = "default", children, ...props }, ref) => {
    const HeadingComponent = level === 1 ? 'h1' 
      : level === 2 ? 'h2'
      : level === 3 ? 'h3'
      : level === 4 ? 'h4'
      : level === 5 ? 'h5'
      : 'h6';
    
    const variants = {
      gradient: "bg-gradient-to-r from-primary via-purple-600 to-indigo-600 bg-clip-text text-transparent font-bold",
      default: "text-foreground font-semibold",
      subtle: "text-muted-foreground font-medium"
    };

    const sizes = {
      1: "text-4xl md:text-5xl",
      2: "text-2xl md:text-3xl", 
      3: "text-xl md:text-2xl",
      4: "text-lg md:text-xl",
      5: "text-base md:text-lg",
      6: "text-sm md:text-base"
    };

    if (HeadingComponent === 'h1') {
      return (
        <h1
          ref={ref}
          className={cn(
            "transition-all duration-300 hover:scale-105 hover:drop-shadow-sm",
            variants[variant],
            sizes[level],
            "leading-tight tracking-tight",
            className
          )}
          {...props}
        >
          <LanguageText>{children}</LanguageText>
        </h1>
      )
    } else if (HeadingComponent === 'h2') {
      return (
        <h2
          ref={ref}
          className={cn(
            "transition-all duration-300 hover:scale-105 hover:drop-shadow-sm",
            variants[variant],
            sizes[level],
            "leading-tight tracking-tight",
            className
          )}
          {...props}
        >
          <LanguageText>{children}</LanguageText>
        </h2>
      )
    } else if (HeadingComponent === 'h3') {
      return (
        <h3
          ref={ref}
          className={cn(
            "transition-all duration-300 hover:scale-105 hover:drop-shadow-sm",
            variants[variant],
            sizes[level],
            "leading-tight tracking-tight",
            className
          )}
          {...props}
        >
          <LanguageText>{children}</LanguageText>
        </h3>
      )
    } else if (HeadingComponent === 'h4') {
      return (
        <h4
          ref={ref}
          className={cn(
            "transition-all duration-300 hover:scale-105 hover:drop-shadow-sm",
            variants[variant],
            sizes[level],
            "leading-tight tracking-tight",
            className
          )}
          {...props}
        >
          <LanguageText>{children}</LanguageText>
        </h4>
      )
    } else if (HeadingComponent === 'h5') {
      return (
        <h5
          ref={ref}
          className={cn(
            "transition-all duration-300 hover:scale-105 hover:drop-shadow-sm",
            variants[variant],
            sizes[level],
            "leading-tight tracking-tight",
            className
          )}
          {...props}
        >
          <LanguageText>{children}</LanguageText>
        </h5>
      )
    } else {
      return (
        <h6
          ref={ref}
          className={cn(
            "transition-all duration-300 hover:scale-105 hover:drop-shadow-sm",
            variants[variant],
            sizes[level],
            "leading-tight tracking-tight",
            className
          )}
          {...props}
        >
          <LanguageText>{children}</LanguageText>
        </h6>
      )
    }
  }
)
EnhancedHeader.displayName = "EnhancedHeader"

export { EnhancedHeader }