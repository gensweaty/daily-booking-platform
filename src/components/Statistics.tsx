
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth } from 'date-fns';
import { useState, useCallback, useMemo, useEffect } from "react";
import { BookingChart } from "./Statistics/BookingChart";
import { IncomeChart } from "./Statistics/IncomeChart";
import { StatsHeader } from "./Statistics/StatsHeader";
import { StatsCards } from "./Statistics/StatsCards";
import { useOptimizedStatistics } from "@/hooks/useOptimizedStatistics";
import { useOptimizedCRMData } from "@/hooks/useOptimizedCRMData";
import { useExcelExport } from "./Statistics/ExcelExport";
import { Skeleton } from "./ui/skeleton";
import { LanguageText } from "./shared/LanguageText";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "./shared/GeorgianAuthText";
import { useQueryClient } from "@tanstack/react-query";
import { PermissionGate } from "./PermissionGate";

const StatisticsContent = () => {
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
  
  // Use optimized hooks instead of original ones
  const { taskStats, eventStats, customerStats, isLoading } = useOptimizedStatistics(userId, dateRange);
  const { combinedData, isLoading: isLoadingCRM } = useOptimizedCRMData(userId, dateRange);
  const { exportToExcel } = useExcelExport();

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

  // Enhanced effect for automatic data refresh when component mounts or becomes visible
  useEffect(() => {
    const refreshAllStatistics = () => {
      console.log("Refreshing all statistics data automatically");
      
      // Invalidate all statistics-related queries to force fresh data
      queryClient.invalidateQueries({ queryKey: ['optimized-task-stats'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-event-stats'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-customer-stats'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-customers'] });
      
      // Also invalidate legacy query keys for compatibility
      queryClient.invalidateQueries({ queryKey: ['taskStats'] });
      queryClient.invalidateQueries({ queryKey: ['eventStats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm'] });
    };

    // Refresh data immediately when component mounts
    refreshAllStatistics();

    // Set up periodic refresh every 30 seconds for real-time updates
    const intervalId = setInterval(refreshAllStatistics, 30000);

    // Listen for page visibility changes to refresh when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Page became visible - refreshing statistics");
        refreshAllStatistics();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for focus events to refresh when user returns to window
    const handleFocus = () => {
      console.log("Window focused - refreshing statistics");
      refreshAllStatistics();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient, userId]); // Include userId to refresh when user changes

  const handleExport = useCallback(() => {
    if (taskStats && eventStats && customerStats) {
      // Pass customer stats to the export function
      exportToExcel({ taskStats, eventStats, customerStats });
    }
  }, [taskStats, eventStats, customerStats, exportToExcel]);

  const handleDateChange = useCallback((start: Date, end: Date | null) => {
    console.log("Date range changed to:", { start, end: end || start });
    setDateRange({ start, end: end || start });
    
    // Immediately refresh data when date range changes
    queryClient.invalidateQueries({ queryKey: ['optimized-event-stats'] });
    queryClient.invalidateQueries({ queryKey: ['optimized-customer-stats'] });
    queryClient.invalidateQueries({ queryKey: ['optimized-customers'] });
  }, [queryClient]);

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
    totalIncome: 0,
    monthlyIncome: [],
    dailyStats: []
  }), []);

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
  useEffect(() => {
    if (eventStats) {
      console.log("Statistics component - Displaying stats:", { 
        total: eventStats.total,
        partlyPaid: eventStats.partlyPaid,
        fullyPaid: eventStats.fullyPaid,
        totalIncome: eventStats.totalIncome
      });
    }
  }, [eventStats]);

  // Log customer stats and date range
  useEffect(() => {
    console.log("Statistics - Customer Stats for date range:", {
      start: dateRange.start.toISOString().split('T')[0],
      end: dateRange.end.toISOString().split('T')[0], 
      stats: currentCustomerStats
    });
  }, [currentCustomerStats, dateRange.start, dateRange.end]);

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

export const Statistics = () => {
  return (
    <PermissionGate requiredPermission="statistics">
      <StatisticsContent />
    </PermissionGate>
  );
};
