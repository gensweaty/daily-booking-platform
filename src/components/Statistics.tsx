
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
import { useQueryClient } from "@tanstack/react-query";

export const Statistics = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const isGeorgian = language === 'ka';
  const currentDate = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Memoize userId for stable reference in dependencies
  const userId = useMemo(() => user?.id, [user?.id]);
  
  // Optimized hook usage with proper dependencies and real-time responsiveness
  const { taskStats, eventStats, isLoading } = useStatistics(userId, dateRange);
  const { combinedData, isLoading: isLoadingCRM } = useCRMData(userId, dateRange);
  const { exportToExcel } = useExcelExport();

  // Calculate customer statistics - now respects date range from useCRMData
  const customerStats = useMemo(() => {
    if (!combinedData) return { total: 0, withBooking: 0, withoutBooking: 0 };
    
    const total = combinedData.length;
    const withBooking = combinedData.filter(item => 
      item.create_event === true || 
      (item.start_date && item.end_date)
    ).length;
    const withoutBooking = total - withBooking;
    
    console.log("Customer Stats for date range:", { 
      start: dateRange.start.toISOString().split('T')[0], 
      end: dateRange.end.toISOString().split('T')[0],
      totalCustomers: total, 
      withBooking, 
      withoutBooking 
    });
    
    return { total, withBooking, withoutBooking };
  }, [combinedData, dateRange]);

  // Add effect to validate eventStats specifically
  useEffect(() => {
    if (eventStats) {
      console.log("Statistics component - eventStats:", { 
        totalEvents: eventStats.total,
        partlyPaid: eventStats.partlyPaid,
        fullyPaid: eventStats.fullyPaid,
        totalIncome: eventStats.totalIncome,
        totalIncomeType: typeof eventStats.totalIncome,
        isValidNumber: typeof eventStats.totalIncome === 'number' && !isNaN(eventStats.totalIncome)
      });
    }
  }, [eventStats]);

  // Configure automatic refresh interval - reduced to 30 seconds for more responsive updates
  useEffect(() => {
    // Function to refresh data - now with a more focused approach
    const refreshData = () => {
      console.log("Refreshing statistics data on interval");
      // Use selective invalidation to minimize unnecessary refetches
      queryClient.invalidateQueries({ queryKey: ['taskStats'] });
      queryClient.invalidateQueries({ queryKey: ['eventStats'] });
    };

    // Set up periodic refresh every 30 seconds
    const intervalId = setInterval(refreshData, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient]);

  const handleExport = useCallback(() => {
    if (taskStats && eventStats) {
      // Pass customer stats to the export function
      exportToExcel({ taskStats, eventStats, customerStats });
    }
  }, [taskStats, eventStats, customerStats, exportToExcel]);

  const handleDateChange = useCallback((start: Date, end: Date | null) => {
    console.log("Date range changed to:", { start, end: end || start });
    setDateRange({ start, end: end || start });
  }, []);

  // Default stats 
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
          <StatsCards 
            taskStats={currentTaskStats} 
            eventStats={currentEventStats}
            customerStats={currentCustomerStats}
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
