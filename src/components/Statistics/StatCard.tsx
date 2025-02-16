
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { TranslationType } from "@/translations/types";

interface StatCardProps {
  title: keyof TranslationType;
  value: string | number;
  icon: LucideIcon;
  description: keyof TranslationType;
  descriptionValues?: string;
}

export const StatCard = ({ title, value, icon: Icon, description, descriptionValues }: StatCardProps) => {
  const { t } = useLanguage();
  
  return (
    <Card className="p-4 flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{t(title)}</h3>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">
        {descriptionValues || t(description)}
      </p>
    </Card>
  );
};
