
import { CircleDollarSign, Clock, CheckSquare, ListTodo } from "lucide-react";
import { StatCard } from "./StatCard";

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
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="dashboard.totalTasks"
        value={taskStats.total}
        icon={ListTodo}
        description={`${taskStats.completed} dashboard.completed`}
      />
      <StatCard
        title="dashboard.inProgress"
        value={taskStats.inProgress}
        icon={Clock}
        description={`${taskStats.todo} dashboard.todo`}
      />
      <StatCard
        title="dashboard.totalEvents"
        value={eventStats.total}
        icon={CheckSquare}
        description={`${eventStats.partlyPaid} dashboard.partlyPaid, ${eventStats.fullyPaid} dashboard.fullyPaid`}
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
