
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from "../ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t, language } = useLanguage();

  const exportToExcel = (data: StatsData) => {
    if (!data.eventStats?.events) {
      toast({
        title: t("crm.error"),
        description: t("crm.noDataToExport"),
        variant: "destructive",
      });
      return;
    }

    // Create statistics summary data
    const statsData = [{
      [t("dashboard.category")]: t("dashboard.taskStatistics"),
      [t("dashboard.total")]: data.taskStats?.total || 0,
      [t("dashboard.details")]: `${t("dashboard.completed")}: ${data.taskStats?.completed || 0}`,
      [t("dashboard.additionalInfo")]: `${t("dashboard.inProgress")}: ${data.taskStats?.inProgress || 0}, ${t("dashboard.todo")}: ${data.taskStats?.todo || 0}`,
    }, {
      [t("dashboard.category")]: t("dashboard.eventStatistics"),
      [t("dashboard.total")]: data.eventStats?.total || 0,
      [t("dashboard.details")]: `${t("dashboard.partlyPaid")}: ${data.eventStats?.partlyPaid || 0}`,
      [t("dashboard.additionalInfo")]: `${t("dashboard.fullyPaid")}: ${data.eventStats?.fullyPaid || 0}`,
    }, {
      [t("dashboard.category")]: '',
      [t("dashboard.total")]: '',
      [t("dashboard.details")]: '',
      [t("dashboard.additionalInfo")]: '',
    }, {
      [t("dashboard.category")]: t("dashboard.financialSummary"),
      [t("dashboard.total")]: t("dashboard.totalIncome"),
      [t("dashboard.details")]: `$${data.eventStats?.totalIncome?.toFixed(2) || '0.00'}`,
      [t("dashboard.additionalInfo")]: t("dashboard.fromAllEvents"),
    }];

    // Transform events data for Excel
    const eventsData = data.eventStats.events.map(event => ({
      [t("crm.fullName")]: `${event.title || ''} ${event.user_surname || ''}`.trim(),
      [t("crm.phoneNumber")]: event.user_number || '',
      [t("crm.socialLinkEmail")]: event.social_network_link || '',
      [t("crm.paymentStatus")]: event.payment_status || '',
      [t("events.paymentAmount")]: event.payment_amount ? `$${event.payment_amount}` : '',
      [t("events.date")]: event.start_date ? format(new Date(event.start_date), 'dd.MM.yyyy') : '',
      [t("events.time")]: event.start_date && event.end_date ? 
        `${format(new Date(event.start_date), 'HH:mm')} - ${format(new Date(event.end_date), 'HH:mm')}` : '',
      [t("crm.comment")]: event.event_notes || '',
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create and add statistics worksheet
    const wsStats = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, t("dashboard.summaryStatistics"));

    // Set statistics column widths
    wsStats['!cols'] = [
      { wch: 20 },  // Category
      { wch: 15 },  // Total
      { wch: 30 },  // Details
      { wch: 40 },  // Additional Info
    ];

    // Create and add events worksheet
    const wsEvents = XLSX.utils.json_to_sheet(eventsData);
    XLSX.utils.book_append_sheet(wb, wsEvents, t("dashboard.eventsData"));

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
    XLSX.writeFile(wb, `${t("dashboard.statistics")}-${dateStr}.xlsx`);

    toast({
      title: t("dashboard.exportSuccessful"),
      description: t("dashboard.exportSuccessMessage"),
    });
  };

  return { exportToExcel };
};
