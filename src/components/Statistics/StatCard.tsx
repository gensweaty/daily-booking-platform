
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  valueClassName?: string;
}

export const StatCard = ({ title, value, icon: Icon, description, valueClassName }: StatCardProps) => {
  return (
    <Card className="p-4 flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">
          <LanguageText>{title}</LanguageText>
        </h3>
      </div>
      <div className={valueClassName || "text-2xl font-bold"}>
        <LanguageText withFont={typeof value === 'string'}>{value}</LanguageText>
      </div>
      <p className="text-xs text-muted-foreground">
        <LanguageText>{description}</LanguageText>
      </p>
    </Card>
  );
};
