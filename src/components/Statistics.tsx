
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth } from 'date-fns';
import { useState, useCallback, useMemo } from "react";
import { BookingChart } from "./Statistics/BookingChart";
import { IncomeChart } from "./Statistics/IncomeChart";
import { StatsHeader } from "./Statistics/StatsHeader";
import { StatsCards } from "./Statistics/StatsCards";
import { useStatistics } from "./Statistics/useStatistics";
import { useExcelExport } from "./Statistics/ExcelExport";
import { Skeleton } from "./ui/skeleton";
import { LanguageText } from "./shared/LanguageText";

export const Statistics = () => {
  const { user } = useAuth();
  const currentDate = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Memoize userId for stable reference in dependencies
  const userId = useMemo(() => user?.id, [user?.id]);
  
  // Optimized hook usage with proper dependencies
  const { taskStats, eventStats, isLoading } = useStatistics(userId, dateRange);
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

  // Memoize the stats data to avoid unnecessary re-renders
  const currentTaskStats = useMemo(() => taskStats || defaultTaskStats, [taskStats, defaultTaskStats]);
  const currentEventStats = useMemo(() => eventStats || defaultEventStats, [eventStats, defaultEventStats]);
  const chartData = useMemo(() => eventStats?.dailyStats || [], [eventStats?.dailyStats]);
  const incomeData = useMemo(() => eventStats?.monthlyIncome || [], [eventStats?.monthlyIncome]);

  // Additional debugging to verify data
  useMemo(() => {
    if (eventStats) {
      console.log("Statistics component - Displaying stats:", { 
        total: eventStats.total,
        partlyPaid: eventStats.partlyPaid,
        fullyPaid: eventStats.fullyPaid,
        totalIncome: eventStats.totalIncome
      });
    }
  }, [eventStats]);

  return (
    <div className="space-y-6">
      <StatsHeader 
        dateRange={dateRange}
        onDateChange={handleDateChange}
        onExport={handleExport}
        isLoading={isLoading}
      />
      
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        </div>
      ) : (
        <>
          <StatsCards 
            taskStats={currentTaskStats} 
            eventStats={currentEventStats} 
          />

          <div className="grid gap-4 md:grid-cols-2">
            <BookingChart data={chartData} />
            <IncomeChart data={incomeData} />
          </div>
        </>
      )}
    </div>
  );
};
