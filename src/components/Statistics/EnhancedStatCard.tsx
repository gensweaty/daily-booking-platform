import { LucideIcon } from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  valueClassName?: string;
  color?: "purple" | "green" | "orange" | "blue";
}

export const EnhancedStatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  valueClassName,
  color = "purple"
}: EnhancedStatCardProps) => {
  // Enhanced color mapping with gradients and modern styling
  const colorStyles = {
    purple: {
      gradient: "from-purple-500/10 to-indigo-500/10",
      iconBg: "bg-gradient-to-br from-purple-500 to-indigo-600",
      border: "border-purple-200/50 dark:border-purple-800/50",
      accent: "text-purple-600 dark:text-purple-400"
    },
    green: {
      gradient: "from-emerald-500/10 to-teal-500/10", 
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
      border: "border-emerald-200/50 dark:border-emerald-800/50",
      accent: "text-emerald-600 dark:text-emerald-400"
    },
    orange: {
      gradient: "from-orange-500/10 to-amber-500/10",
      iconBg: "bg-gradient-to-br from-orange-500 to-amber-600", 
      border: "border-orange-200/50 dark:border-orange-800/50",
      accent: "text-orange-600 dark:text-orange-400"
    },
    blue: {
      gradient: "from-blue-500/10 to-cyan-500/10",
      iconBg: "bg-gradient-to-br from-blue-500 to-cyan-600",
      border: "border-blue-200/50 dark:border-blue-800/50", 
      accent: "text-blue-600 dark:text-blue-400"
    }
  };

  const styles = colorStyles[color];
  
  // Determine if the value is a financial figure (contains currency symbol)
  const isCurrencyValue = typeof value === 'string' && /^[₾$€£¥]/.test(value);

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl bg-gradient-to-br",
      styles.gradient,
      styles.border,
      "border backdrop-blur-sm p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg",
      "bg-white/80 dark:bg-gray-900/80"
    )}>
      {/* Subtle animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent dark:from-gray-800/50 transition-opacity duration-300 group-hover:opacity-75" />
      
      <div className="relative z-10 space-y-4">
        {/* Icon and title section */}
        <div className="flex items-center justify-between">
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            styles.iconBg,
            "shadow-lg transition-transform duration-300 group-hover:scale-110"
          )}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          
          <div className="text-right">
            <h3 className="text-sm font-medium text-muted-foreground">
              <LanguageText>{title}</LanguageText>
            </h3>
          </div>
        </div>

        {/* Value section */}
        <div className={valueClassName || "text-3xl font-bold"}>
          {isCurrencyValue ? (
            <span className={styles.accent}>{value}</span>
          ) : (
            <LanguageText withFont={typeof value === 'string'}>
              <span className={styles.accent}>{value}</span>
            </LanguageText>
          )}
        </div>

        {/* Description section */}
        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          <LanguageText>{description}</LanguageText>
        </p>
      </div>

      {/* Subtle glow effect on hover */}
      <div className={cn(
        "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-20",
        styles.iconBg
      )} />
    </div>
  );
};