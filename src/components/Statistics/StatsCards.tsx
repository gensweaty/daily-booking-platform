
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "./StatCard";
import {
  CheckCircle2,
  Clock,
  CalendarCheck,
  DollarSign,
  EuroIcon,
  BanknoteIcon,
} from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";
import { getCurrencySymbol } from "@/lib/currency";

interface StatsCardsProps {
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
  };
  eventStats: {
    total: number;
    partlyPaid: number;
    fullyPaid: number;
    totalIncome: number;
  };
}

export const StatsCards = ({ taskStats, eventStats }: StatsCardsProps) => {
  const { t, language } = useLanguage();
  
  // Get the appropriate currency symbol based on language
  const currencySymbol = getCurrencySymbol(language);

  // Format the income value to have 2 decimal places and add currency symbol
  const formattedIncome = `${currencySymbol}${eventStats.totalIncome.toFixed(2)}`;
  
  // Choose the appropriate currency icon based on language
  const CurrencyIcon = language === 'es' ? EuroIcon : 
                       language === 'ka' ? BanknoteIcon : DollarSign;
  
  // For debugging
  console.log("StatsCards - Rendering with event stats:", {
    total: eventStats.total,
    partlyPaid: eventStats.partlyPaid,
    fullyPaid: eventStats.fullyPaid,
    totalIncome: eventStats.totalIncome,
    currency: currencySymbol
  });

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard
        title={t("dashboard.totalTasks")}
        value={taskStats.total}
        description={`${taskStats.completed} ${t("dashboard.completed")}`}
        icon={CheckCircle2}
        color="purple"
      />
      <StatCard
        title={t("dashboard.inProgress")}
        value={taskStats.inProgress}
        description={`${taskStats.todo} ${t("dashboard.todo")}`}
        icon={Clock}
        color="orange"
      />
      <StatCard
        title={t("dashboard.totalEvents")}
        value={eventStats.total}
        description={`${eventStats.partlyPaid} ${t("dashboard.partlyPaid")}, ${eventStats.fullyPaid} ${t("dashboard.fullyPaid")}`}
        icon={CalendarCheck}
        color="green"
      />
      <StatCard
        title={t("dashboard.totalIncome")}
        value={formattedIncome}
        description={t("dashboard.fromAllEvents")}
        icon={CurrencyIcon}
        valueClassName="text-2xl"
        color="blue"
      />
    </div>
  );
};
