
import { CheckSquare, Clock, BanknoteIcon, CalendarIcon } from "lucide-react";
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
  const stats = [
    {
      title: "Total Tasks",
      value: taskStats?.total || 0,
      icon: CheckSquare,
      description: `${taskStats?.completed || 0} completed`,
    },
    {
      title: "Tasks In Progress",
      value: taskStats?.inProgress || 0,
      icon: Clock,
      description: `${taskStats?.todo || 0} todo`,
    },
    {
      title: "Total Events",
      value: eventStats?.total || 0,
      icon: CalendarIcon,
      description: `${eventStats?.partlyPaid || 0} partly paid, ${eventStats?.fullyPaid || 0} fully paid`,
    },
    {
      title: "Total Income",
      value: `₾${eventStats?.totalIncome?.toFixed(2) || '0.00'}`,
      icon: BanknoteIcon,
      description: "From all events",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};
