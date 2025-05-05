
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/LanguageContext"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        labelVariants(), 
        className,
        isGeorgian ? "ka-text" : ""
      )}
      style={isGeorgian ? {
        fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
        letterSpacing: "-0.2px"
      } : undefined}
      {...props}
    />
  )
})
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
