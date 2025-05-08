
import { utils, writeFile } from 'xlsx';
import { format } from 'date-fns';
import { getCurrencySymbol } from "@/lib/currency";
import { Language } from "@/translations/types";

export function useExcelExport() {
  // Function to handle export of stats to Excel
  const exportToExcel = ({ taskStats, eventStats, customerStats, language = 'en' }: { 
    taskStats: any; 
    eventStats: any; 
    customerStats: any; 
    language?: Language;
  }) => {
    const currencySymbol = getCurrencySymbol(language);
    
    // Format current date for filename
    const currentDate = format(new Date(), 'yyyy-MM-dd');
    const filename = `statistics_${currentDate}.xlsx`;
    
    // Create workbook and worksheets
    const wb = utils.book_new();
    
    // Task statistics data
    const taskData = [
      ['Task Statistics', ''],
      ['Total Tasks', taskStats.total],
      ['Completed Tasks', taskStats.completed],
      ['In Progress Tasks', taskStats.inProgress],
      ['Todo Tasks', taskStats.todo],
      ['', ''],
    ];
    
    // Event statistics data
    const eventData = [
      ['Event Statistics', ''],
      ['Total Events', eventStats.total],
      ['Partly Paid Events', eventStats.partlyPaid],
      ['Fully Paid Events', eventStats.fullyPaid],
      [`Total Income (${currencySymbol})`, 
       typeof eventStats.totalIncome === 'number' ? eventStats.totalIncome.toFixed(2) : '0.00'],
      ['', ''],
    ];
    
    // Customer statistics data
    const customerData = [
      ['Customer Statistics', ''],
      ['Total Customers', customerStats.total],
      ['Customers with Bookings', customerStats.withBooking],
      ['Customers without Bookings', customerStats.withoutBooking],
    ];
    
    // Daily booking stats (if available)
    let dailyBookingData = [];
    if (eventStats.dailyStats && eventStats.dailyStats.length > 0) {
      dailyBookingData = [
        ['', ''],
        ['Daily Booking Statistics', ''],
        ['Date', 'Number of Bookings'],
        ...eventStats.dailyStats.map((stat: any) => [
          `${stat.day} ${stat.month}`, stat.bookings
        ])
      ];
    }
    
    // Monthly income stats (if available)
    let monthlyIncomeData = [];
    if (eventStats.monthlyIncome && eventStats.monthlyIncome.length > 0) {
      monthlyIncomeData = [
        ['', ''],
        ['Monthly Income Statistics', ''],
        ['Month', `Income (${currencySymbol})`],
        ...eventStats.monthlyIncome.map((stat: any) => [
          stat.month, typeof stat.income === 'number' ? stat.income.toFixed(2) : '0.00'
        ])
      ];
    }
    
    // Combine all data
    const combinedData = [
      ...taskData,
      ...eventData,
      ...customerData,
      ...dailyBookingData,
      ...monthlyIncomeData
    ];
    
    // Convert to worksheet
    const ws = utils.aoa_to_sheet(combinedData);
    
    // Add worksheet to workbook
    utils.book_append_sheet(wb, ws, 'Statistics');
    
    // Save file
    writeFile(wb, filename);
  };
  
  return { exportToExcel };
}
