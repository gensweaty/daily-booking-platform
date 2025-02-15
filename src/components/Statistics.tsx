
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { useState } from "react";
import { BookingChart } from "./Statistics/BookingChart";
import { IncomeChart } from "./Statistics/IncomeChart";
import { StatsHeader } from "./Statistics/StatsHeader";
import { StatsCards } from "./Statistics/StatsCards";
import { useStatistics } from "./Statistics/useStatistics";
import { useExcelExport } from "./Statistics/ExcelExport";

export const Statistics = () => {
  const { user } = useAuth();
  const currentDate = new Date();
  const [dateRange, setDateRange] = useState({ 
    start: addMonths(startOfMonth(currentDate), -2), // Start from 2 months ago
    end: endOfMonth(currentDate) // End at current month
  });

  const { taskStats, eventStats } = useStatistics(user?.id, dateRange);
  const { exportToExcel } = useExcelExport();

  const handleExport = () => {
    if (taskStats && eventStats) {
      exportToExcel({ taskStats, eventStats });
    }
  };

  return (
    <div className="space-y-6">
      <StatsHeader 
        dateRange={dateRange}
        onDateChange={(start, end) => setDateRange({ start, end: end || start })}
        onExport={handleExport}
      />
      
      <StatsCards taskStats={taskStats || { total: 0, completed: 0, inProgress: 0, todo: 0 }} 
                  eventStats={eventStats || { total: 0, partlyPaid: 0, fullyPaid: 0, totalIncome: 0 }} />

      <div className="grid gap-4 md:grid-cols-2">
        <BookingChart data={eventStats?.dailyStats || []} />
        <IncomeChart data={eventStats?.monthlyIncome || []} />
      </div>
    </div>
  );
};
