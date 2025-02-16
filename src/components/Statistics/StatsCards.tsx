
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

  const formatTaskDescription = (completed: number) => {
    return t("dashboard.completed").replace("{count}", completed.toString());
  };

  const formatProgressDescription = (todo: number) => {
    return t("dashboard.todo").replace("{count}", todo.toString());
  };

  const formatEventDescription = (partlyPaid: number, fullyPaid: number) => {
    return `${partlyPaid} ${t("dashboard.partlyPaid")}, ${fullyPaid} ${t("dashboard.fullyPaid")}`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="dashboard.totalTasks"
        value={taskStats.total}
        icon={ListTodo}
        description="dashboard.taskSummary"
        descriptionValues={formatTaskDescription(taskStats.completed)}
      />
      <StatCard
        title="dashboard.inProgress"
        value={taskStats.inProgress}
        icon={Clock}
        description="dashboard.progressSummary"
        descriptionValues={formatProgressDescription(taskStats.todo)}
      />
      <StatCard
        title="dashboard.totalEvents"
        value={eventStats.total}
        icon={CheckSquare}
        description="dashboard.eventSummary"
        descriptionValues={formatEventDescription(eventStats.partlyPaid, eventStats.fullyPaid)}
      />
      <StatCard
        title="dashboard.totalIncome"
        value={`$${eventStats.totalIncome.toFixed(2)}`}
        icon={CircleDollarSign}
        description="dashboard.fromAllEvents"
      />
    </div>
  );
};
