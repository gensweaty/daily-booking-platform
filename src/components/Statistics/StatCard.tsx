
import { Card } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  valueClassName?: string;
  color?: "purple" | "green" | "orange" | "blue";
  trend?: string;
  trendLabel?: string;
}

export const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  valueClassName,
  color = "purple",
  trend,
  trendLabel
}: StatCardProps) => {
  // Enhanced color mapping with gradients and modern styling
  const colorStyles = {
    purple: {
      icon: "text-purple-600 dark:text-purple-400",
      gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
      border: "border-l-purple-500 dark:border-l-purple-400",
      shadow: "shadow-purple-100 dark:shadow-purple-900/20"
    },
    green: {
      icon: "text-emerald-600 dark:text-emerald-400", 
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      border: "border-l-emerald-500 dark:border-l-emerald-400",
      shadow: "shadow-emerald-100 dark:shadow-emerald-900/20"
    },
    orange: {
      icon: "text-orange-600 dark:text-orange-400",
      gradient: "from-orange-500/10 via-orange-500/5 to-transparent", 
      border: "border-l-orange-500 dark:border-l-orange-400",
      shadow: "shadow-orange-100 dark:shadow-orange-900/20"
    },
    blue: {
      icon: "text-blue-600 dark:text-blue-400",
      gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
      border: "border-l-blue-500 dark:border-l-blue-400", 
      shadow: "shadow-blue-100 dark:shadow-blue-900/20"
    },
  };
  
  // Determine if the value is a financial figure (contains currency symbol)
  const isCurrencyValue = typeof value === 'string' && /^[₾$€£¥]/.test(value);
  
  // Parse trend direction
  const isPositiveTrend = trend?.startsWith('+');
  const TrendIcon = isPositiveTrend ? TrendingUp : TrendingDown;

  return (
    <Card className={cn(
      "group relative p-6 border-l-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
      "bg-gradient-to-br",
      colorStyles[color].gradient,
      colorStyles[color].border,
      colorStyles[color].shadow,
      "backdrop-blur-sm",
      "dark:bg-gradient-to-br dark:from-gray-900/50 dark:to-gray-800/30"
    )}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-20 h-20 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-full h-full" />
      </div>
      
      {/* Header with icon and title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={cn(
            "p-2.5 rounded-xl bg-white/80 dark:bg-gray-800/80 shadow-sm",
            "group-hover:scale-110 transition-transform duration-200"
          )}>
            <Icon className={cn("w-5 h-5", colorStyles[color].icon)} />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            <LanguageText>{title}</LanguageText>
          </h3>
        </div>
        
        {/* Trend indicator */}
        {trend && (
          <div className={cn(
            "flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
            isPositiveTrend 
              ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/30" 
              : "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30"
          )}>
            <TrendIcon className="w-3 h-3" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      
      {/* Main value */}
      <div className={cn(
        valueClassName || "text-3xl font-bold text-gray-900 dark:text-white mb-2",
        "group-hover:scale-105 transition-transform duration-200"
      )}>
        {/* For currency values, don't use LanguageText as translation might break display */}
        {isCurrencyValue ? (
          <span>{value}</span>
        ) : (
          <LanguageText withFont={typeof value === 'string'}>{value}</LanguageText>
        )}
      </div>
      
      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        <LanguageText>{description}</LanguageText>
      </p>
      
      {/* Trend label */}
      {trendLabel && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          <LanguageText>{trendLabel}</LanguageText>
        </p>
      )}
      
      {/* Subtle glow effect on hover */}
      <div className={cn(
        "absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
        "bg-gradient-to-r",
        colorStyles[color].gradient
      )} />
    </Card>
  );
};
