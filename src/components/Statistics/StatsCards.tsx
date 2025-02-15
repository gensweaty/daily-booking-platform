
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
        title="Total Tasks"
        value={taskStats.total}
        icon={ListTodo}
        description={`${taskStats.completed} completed`}
      />
      <StatCard
        title="In Progress"
        value={taskStats.inProgress}
        icon={Clock}
        description={`${taskStats.todo} todo`}
      />
      <StatCard
        title="Total Events"
        value={eventStats.total}
        icon={CheckSquare}
        description={`${eventStats.fullyPaid} fully paid`}
      />
      <StatCard
        title="Total Income"
        value={`$${eventStats.totalIncome.toFixed(2)}`}
        icon={CircleDollarSign}
        description={`${eventStats.partlyPaid} partly paid`}
      />
    </div>
  );
};
