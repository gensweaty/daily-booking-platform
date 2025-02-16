
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
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard
        title={isSpanish ? "Tareas Totales" : "Total Tasks"}
        value={taskStats.total}
        description={isSpanish ? `${taskStats.completed} completadas` : `${taskStats.completed} completed`}
        icon={<CheckCircle2 className="h-4 w-4" />}
      />
      <StatCard
        title={isSpanish ? "En Progreso" : "In Progress"}
        value={taskStats.inProgress}
        description={isSpanish ? "pendientes" : "pending"}
        icon={<Clock className="h-4 w-4" />}
      />
      <StatCard
        title={isSpanish ? "Eventos Totales" : "Total Events"}
        value={eventStats.total}
        description={
          isSpanish
            ? `${eventStats.partlyPaid} pago parcial, ${eventStats.fullyPaid} pago completo`
            : `${eventStats.partlyPaid} partly paid, ${eventStats.fullyPaid} fully paid`
        }
        icon={<CalendarCheck className="h-4 w-4" />}
      />
      <StatCard
        title={isSpanish ? "Ingresos Totales" : "Total Income"}
        value={`${isSpanish ? '€' : '$'}${eventStats.totalIncome.toFixed(2)}`}
        description={isSpanish ? "de todos los eventos" : "from all events"}
        icon={isSpanish ? <EuroIcon className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
        valueClassName="text-2xl"
      />
    </div>
  );
};
