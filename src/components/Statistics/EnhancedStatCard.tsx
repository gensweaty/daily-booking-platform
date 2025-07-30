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
  // Enhanced color mapping to match the design reference
  const colorStyles = {
    purple: {
      cardBg: "bg-gradient-to-br from-purple-900/90 to-indigo-900/90",
      iconBg: "bg-gradient-to-br from-purple-500 to-indigo-600",
      valueColor: "text-purple-400",
      textColor: "text-gray-300"
    },
    green: {
      cardBg: "bg-gradient-to-br from-emerald-900/90 to-teal-900/90", 
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
      valueColor: "text-emerald-400",
      textColor: "text-gray-300"
    },
    orange: {
      cardBg: "bg-gradient-to-br from-orange-900/90 to-amber-900/90",
      iconBg: "bg-gradient-to-br from-orange-500 to-amber-600", 
      valueColor: "text-orange-400",
      textColor: "text-gray-300"
    },
    blue: {
      cardBg: "bg-gradient-to-br from-blue-900/90 to-cyan-900/90",
      iconBg: "bg-gradient-to-br from-blue-500 to-cyan-600",
      valueColor: "text-blue-400",
      textColor: "text-gray-300"
    }
  };

  const styles = colorStyles[color];
  
  // Determine if the value is a financial figure (contains currency symbol)
  const isCurrencyValue = typeof value === 'string' && /^[₾$€£¥]/.test(value);

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl",
      "border border-white/10 backdrop-blur-sm",
      styles.cardBg
    )}>
      {/* Subtle animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative z-10">
        {/* Header with icon and title */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-xl",
            styles.iconBg,
            "shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl"
          )}>
            <Icon className="h-7 w-7 text-white" />
          </div>
          
          <div className="text-right">
            <h3 className={cn("text-sm font-medium", styles.textColor)}>
              <LanguageText>{title}</LanguageText>
            </h3>
          </div>
        </div>

        {/* Main value */}
        <div className="mb-2">
          {isCurrencyValue ? (
            <span className={cn("text-4xl font-bold", styles.valueColor)}>{value}</span>
          ) : (
            <LanguageText withFont={typeof value === 'string'}>
              <span className={cn("text-4xl font-bold", styles.valueColor)}>{value}</span>
            </LanguageText>
          )}
        </div>

        {/* Description */}
        <p className={cn("text-sm leading-relaxed", styles.textColor)}>
          <LanguageText>{description}</LanguageText>
        </p>
      </div>

      {/* Subtle glow effect on hover */}
      <div className={cn(
        "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-10",
        styles.iconBg
      )} />
    </div>
  );
};