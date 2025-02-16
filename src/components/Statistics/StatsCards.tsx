
import { CircleDollarSign, Clock, CheckSquare, ListTodo } from "lucide-react";
import { StatCard } from "./StatCard";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t("dashboard.totalTasks")}
        value={taskStats.total}
        icon={ListTodo}
        description={`${taskStats.completed} ${t("dashboard.completed")}`}
      />
      <StatCard
        title={t("dashboard.inProgress")}
        value={taskStats.inProgress}
        icon={Clock}
        description={`${taskStats.todo} ${t("dashboard.todo")}`}
      />
      <StatCard
        title={t("dashboard.totalEvents")}
        value={eventStats.total}
        icon={CheckSquare}
        description={`${eventStats.partlyPaid} ${t("dashboard.partlyPaid")}, ${eventStats.fullyPaid} ${t("dashboard.fullyPaid")}`}
      />
      <StatCard
        title={t("dashboard.totalIncome")}
        value={`$${eventStats.totalIncome.toFixed(2)}`}
        icon={CircleDollarSign}
        description={t("dashboard.fromAllEvents")}
      />
    </div>
  );
};
