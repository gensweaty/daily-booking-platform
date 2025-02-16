
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from "../ui/use-toast";

interface StatsData {
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
    events: any[];
  };
}

export const useExcelExport = () => {
  const { toast } = useToast();

  const exportToExcel = (data: StatsData) => {
    if (!data.eventStats?.events) {
      toast({
        title: "No data to export",
        description: "There are no events in the selected date range.",
        variant: "destructive",
      });
      return;
    }

    // Create statistics summary data
    const statsData = [{
      'Category': 'Tasks Statistics',
      'Total': data.taskStats?.total || 0,
      'Details': `Completed tasks: ${data.taskStats?.completed || 0}`,
      'Additional Info': `Tasks in progress: ${data.taskStats?.inProgress || 0}, Tasks todo: ${data.taskStats?.todo || 0}`,
    }, {
      'Category': 'Events Statistics',
      'Total': data.eventStats?.total || 0,
      'Details': `Partly paid events: ${data.eventStats?.partlyPaid || 0}`,
      'Additional Info': `Fully paid events: ${data.eventStats?.fullyPaid || 0}`,
    }, {
      'Category': '',
      'Total': '',
      'Details': '',
      'Additional Info': '',
    }, {
      'Category': 'Financial Summary',
      'Total': 'Total Income',
      'Details': `$${data.eventStats?.totalIncome?.toFixed(2) || '0.00'}`,
      'Additional Info': 'From all events',
    }];

    // Transform events data for Excel
    const eventsData = data.eventStats.events.map(event => ({
      'Full Name': `${event.title || ''} ${event.user_surname || ''}`.trim(),
      'Phone Number': event.user_number || '',
      'Social Link/Email': event.social_network_link || '',
      'Payment Status': event.payment_status || '',
      'Payment Amount': event.payment_amount ? `$${event.payment_amount}` : '',
      'Date': event.start_date ? format(new Date(event.start_date), 'dd.MM.yyyy') : '',
      'Time': event.start_date && event.end_date ? 
        `${format(new Date(event.start_date), 'HH:mm')} - ${format(new Date(event.end_date), 'HH:mm')}` : '',
      'Comment': event.event_notes || '',
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create and add statistics worksheet
    const wsStats = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, 'Summary Statistics');

    // Set statistics column widths
    wsStats['!cols'] = [
      { wch: 20 },  // Category
      { wch: 15 },  // Total
      { wch: 30 },  // Details
      { wch: 40 },  // Additional Info
    ];

    // Create and add events worksheet
    const wsEvents = XLSX.utils.json_to_sheet(eventsData);
    XLSX.utils.book_append_sheet(wb, wsEvents, 'Events Data');

    // Set events column widths
    wsEvents['!cols'] = [
      { wch: 20 },  // Full Name
      { wch: 15 },  // Phone Number
      { wch: 30 },  // Social Link/Email
      { wch: 15 },  // Payment Status
      { wch: 15 },  // Payment Amount
      { wch: 12 },  // Date
      { wch: 20 },  // Time
      { wch: 40 },  // Comment
    ];

    // Generate Excel file
    const dateStr = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `statistics-${dateStr}.xlsx`);

    toast({
      title: "Export successful",
      description: "The statistics data has been exported to Excel.",
    });
  };

  return { exportToExcel };
};
