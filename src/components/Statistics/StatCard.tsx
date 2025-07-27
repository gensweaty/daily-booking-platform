
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  valueClassName?: string;
  color?: "purple" | "green" | "orange" | "blue"; // Added color prop
}

export const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  valueClassName,
  color = "purple" // Default color
}: StatCardProps) => {
  // Color mapping for icon and border
  const colorStyles = {
    purple: "text-[#9b87f5] border-l-[#9b87f5]",
    green: "text-[#4ade80] border-l-[#4ade80]",
    orange: "text-[#f97316] border-l-[#f97316]",
    blue: "text-[#3b82f6] border-l-[#3b82f6]",
  };
  
  // Determine if the value is a financial figure (contains currency symbol)
  const isCurrencyValue = typeof value === 'string' && /^[₾$€£¥]/.test(value);

  return (
    <Card className={cn(
      "p-4 flex flex-col space-y-2 overflow-hidden border-l-4", 
      colorStyles[color]
    )}>
      <div className="flex items-center space-x-2">
        <Icon className={cn("w-4 h-4", colorStyles[color])} />
        <h3 className="text-sm font-medium">
          <LanguageText>{title}</LanguageText>
        </h3>
      </div>
      <div className={valueClassName || "text-2xl font-bold"}>
        {/* For currency values, don't use LanguageText as translation might break display */}
        {isCurrencyValue ? (
          <span>{value}</span>
        ) : (
          <LanguageText withFont={typeof value === 'string'}>{value}</LanguageText>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <LanguageText>{description}</LanguageText>
      </p>
    </Card>
  );
};
