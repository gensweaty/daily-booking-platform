
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth } from 'date-fns';
import { useState, useCallback, useMemo } from "react";
import { BookingChart } from "./Statistics/BookingChart";
import { IncomeChart } from "./Statistics/IncomeChart";
import { StatsHeader } from "./Statistics/StatsHeader";
import { StatsCards } from "./Statistics/StatsCards";
import { useStatistics } from "./Statistics/useStatistics";
import { useExcelExport } from "./Statistics/ExcelExport";

export const Statistics = () => {
  const { user } = useAuth();
  const currentDate = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const { taskStats, eventStats, isLoading } = useStatistics(user?.id, dateRange);
  const { exportToExcel } = useExcelExport();

  const handleExport = useCallback(() => {
    if (taskStats && eventStats) {
      exportToExcel({ taskStats, eventStats });
    }
  }, [taskStats, eventStats, exportToExcel]);

  const handleDateChange = useCallback((start: Date, end: Date | null) => {
    setDateRange({ start, end: end || start });
  }, []);

  const defaultTaskStats = useMemo(() => ({ 
    total: 0, 
    completed: 0, 
    inProgress: 0, 
    todo: 0 
  }), []);

  const defaultEventStats = useMemo(() => ({ 
    total: 0, 
    partlyPaid: 0, 
    fullyPaid: 0, 
    totalIncome: 0 
  }), []);

  return (
    <div className="space-y-6">
      <StatsHeader 
        dateRange={dateRange}
        onDateChange={handleDateChange}
        onExport={handleExport}
      />
      
      <StatsCards 
        taskStats={taskStats || defaultTaskStats} 
        eventStats={eventStats || defaultEventStats} 
      />

      <div className="grid gap-4 md:grid-cols-2">
        <BookingChart data={eventStats?.dailyStats || []} />
        <IncomeChart data={eventStats?.monthlyIncome || []} />
      </div>
    </div>
  );
};
