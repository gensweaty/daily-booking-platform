
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from "../ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo } from 'react';

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
  const isSpanish = language === 'es';

  const exportToExcel = useMemo(() => (data: StatsData) => {
    if (!data.eventStats?.events) {
      toast({
        title: t("crm.noDataToExport"),
        description: t("crm.error"),
        variant: "destructive",
      });
      return;
    }

    // Create statistics summary data
    const statsData = [{
      [t('dashboard.category')]: t('dashboard.taskStatistics'),
      [t('dashboard.total')]: data.taskStats?.total || 0,
      [t('dashboard.details')]: `${t('dashboard.completed')}: ${data.taskStats?.completed || 0}`,
      [t('dashboard.additionalInfo')]: `${t('dashboard.inProgress')}: ${data.taskStats?.inProgress || 0}, ${t('dashboard.todo')}: ${data.taskStats?.todo || 0}`,
    }, {
      [t('dashboard.category')]: t('dashboard.eventStatistics'),
      [t('dashboard.total')]: data.eventStats?.total || 0,
      [t('dashboard.details')]: `${t('dashboard.partlyPaid')}: ${data.eventStats?.partlyPaid || 0}`,
      [t('dashboard.additionalInfo')]: `${t('dashboard.fullyPaid')}: ${data.eventStats?.fullyPaid || 0}`,
    }, {
      [t('dashboard.category')]: '',
      [t('dashboard.total')]: '',
      [t('dashboard.details')]: '',
      [t('dashboard.additionalInfo')]: '',
    }, {
      [t('dashboard.category')]: t('dashboard.financialSummary'),
      [t('dashboard.total')]: t('dashboard.totalIncome'),
      [t('dashboard.details')]: `${isSpanish ? '€' : '$'}${data.eventStats?.totalIncome?.toFixed(2) || '0.00'}`,
      [t('dashboard.additionalInfo')]: t('dashboard.fromAllEvents'),
    }];

    // Transform events data for Excel with translated headers
    const eventsData = data.eventStats.events.map(event => ({
      [t('events.fullName')]: `${event.title || ''} ${event.user_surname || ''}`.trim(),
      [t('events.phoneNumber')]: event.user_number || '',
      [t('events.socialLinkEmail')]: event.social_network_link || '',
      [t('events.paymentStatus')]: event.payment_status || '',
      [t('events.paymentAmount')]: event.payment_amount ? `${isSpanish ? '€' : '$'}${event.payment_amount}` : '',
      [t('events.date')]: event.start_date ? format(new Date(event.start_date), 'dd.MM.yyyy') : '',
      [t('events.time')]: event.start_date && event.end_date ? 
        `${format(new Date(event.start_date), 'HH:mm')} - ${format(new Date(event.end_date), 'HH:mm')}` : '',
      [t('events.eventNotes')]: event.event_notes || '',
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create and add statistics worksheet
    const wsStats = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, t('dashboard.summaryStatistics'));

    // Set statistics column widths
    wsStats['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 40 },
    ];

    // Create and add events worksheet
    const wsEvents = XLSX.utils.json_to_sheet(eventsData);
    XLSX.utils.book_append_sheet(wb, wsEvents, t('dashboard.eventsData'));

    // Set events column widths
    wsEvents['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 20 },
      { wch: 40 },
    ];

    // Generate Excel file
    const dateStr = format(new Date(), 'dd-MM-yyyy');
    XLSX.writeFile(wb, `statistics-${dateStr}.xlsx`);

    toast({
      title: t("dashboard.exportSuccessful"),
      description: t("dashboard.exportSuccessMessage"),
    });
  }, [toast, t, language]);

  return { exportToExcel };
};
