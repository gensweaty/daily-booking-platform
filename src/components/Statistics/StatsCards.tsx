
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "./StatCard";
import {
  CheckCircle2,
  Clock,
  CalendarCheck,
  DollarSign,
  EuroIcon,
} from "lucide-react";

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
  const isSpanish = language === 'es';

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard
        title={t("dashboard.totalTasks")}
        value={taskStats.total}
        description={`${taskStats.completed} ${t("dashboard.completed")}`}
        icon={CheckCircle2}
      />
      <StatCard
        title={t("dashboard.inProgress")}
        value={taskStats.inProgress}
        description={t("dashboard.todo")}
        icon={Clock}
      />
      <StatCard
        title={t("dashboard.totalEvents")}
        value={eventStats.total}
        description={`${eventStats.partlyPaid} ${t("dashboard.partlyPaid")}, ${eventStats.fullyPaid} ${t("dashboard.fullyPaid")}`}
        icon={CalendarCheck}
      />
      <StatCard
        title={t("dashboard.totalIncome")}
        value={`${isSpanish ? '€' : '$'}${eventStats.totalIncome.toFixed(2)}`}
        description={t("dashboard.fromAllEvents")}
        icon={isSpanish ? EuroIcon : DollarSign}
        valueClassName="text-2xl"
      />
    </div>
  );
};
