import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth } from 'date-fns';
import { useState, useCallback, useMemo, useEffect } from "react";
import { BookingChart } from "./Statistics/BookingChart";
import { IncomeChart } from "./Statistics/IncomeChart";
import { StatsHeader } from "./Statistics/StatsHeader";
import { StatsCards } from "./Statistics/StatsCards";
import { useStatistics } from "./Statistics/useStatistics";
import { useExcelExport } from "./Statistics/ExcelExport";
import { useCRMData } from "@/hooks/useCRMData";
import { Skeleton } from "./ui/skeleton";
import { LanguageText } from "./shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "./shared/GeorgianAuthText";

export const Statistics = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currentDate = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Memoize userId for stable reference in dependencies
  const userId = useMemo(() => user?.id, [user?.id]);
  
  // Optimized hook usage with proper dependencies
  const { taskStats, eventStats, isLoading } = useStatistics(userId, dateRange);
  const { combinedData, isLoading: isLoadingCRM } = useCRMData(userId, dateRange);
  const { exportToExcel } = useExcelExport();

  // Calculate customer statistics
  const customerStats = useMemo(() => {
    if (!combinedData) return { total: 0, withBooking: 0, withoutBooking: 0 };

    const total = combinedData.length;
    const withBooking = combinedData.filter(item => 
      item.create_event === true || 
      (item.start_date && item.end_date)
    ).length;
    const withoutBooking = total - withBooking;

    console.log("Customer Stats:", { total, withBooking, withoutBooking });
    
    return { total, withBooking, withoutBooking };
  }, [combinedData]);

  // Add effect to validate eventStats and totalIncome specifically
  useEffect(() => {
    if (eventStats) {
      console.log("Statistics component - Raw eventStats:", { 
        eventStats,
        totalIncomeType: typeof eventStats.totalIncome,
        totalIncomeValue: eventStats.totalIncome,
        isNumber: typeof eventStats.totalIncome === 'number',
        isValidNumber: typeof eventStats.totalIncome === 'number' && !isNaN(eventStats.totalIncome)
      });
    }
  }, [eventStats]);

  const handleExport = useCallback(() => {
    if (taskStats && eventStats) {
      // Pass customer stats to the export function
      exportToExcel({ taskStats, eventStats, customerStats });
    }
  }, [taskStats, eventStats, customerStats, exportToExcel]);

  const handleDateChange = useCallback((start: Date, end: Date | null) => {
    setDateRange({ start, end: end || start });
  }, []);

  // Default task stats
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

  // Default customer stats
  const defaultCustomerStats = useMemo(() => ({
    total: 0,
    withBooking: 0,
    withoutBooking: 0
  }), []);

  // Memoize the stats data to avoid unnecessary re-renders
  const currentTaskStats = useMemo(() => taskStats || defaultTaskStats, [taskStats, defaultTaskStats]);
  const currentEventStats = useMemo(() => eventStats || defaultEventStats, [eventStats, defaultEventStats]);
  const currentCustomerStats = useMemo(() => customerStats || defaultCustomerStats, [customerStats, defaultCustomerStats]);
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

  // Log customer stats
  useEffect(() => {
    console.log("Statistics - Customer Stats:", currentCustomerStats);
  }, [currentCustomerStats]);

  return (
    <div className="space-y-6">
      <StatsHeader 
        dateRange={dateRange}
        onDateChange={handleDateChange}
        onExport={handleExport}
        isLoading={isLoading || isLoadingCRM}
      />
      
      {isLoading || isLoadingCRM ? (
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
          {/* Log right before passing to StatsCards */}
          {console.log("Before rendering StatsCards - currentEventStats:", {
            totalIncome: eventStats.totalIncome,
            type: typeof eventStats.totalIncome
          })}
          
          <StatsCards 
            taskStats={taskStats} 
            eventStats={eventStats}
            customerStats={customerStats}
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
