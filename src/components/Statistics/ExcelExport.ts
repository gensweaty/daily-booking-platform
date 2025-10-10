import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from "../ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo } from 'react';
import { getCurrencySymbol } from "@/lib/currency";

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
    eventIncome?: number;
    standaloneCustomerIncome?: number;
    events: any[];
  };
  customerStats?: {
    total: number;
    withBooking: number;
    withoutBooking: number;
  };
}

export const useExcelExport = () => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  
  // Get currency symbol based on language
  const currencySymbol = useMemo(() => getCurrencySymbol(language), [language]);

  const exportToExcel = useMemo(() => (data: StatsData) => {
    if (!data.eventStats?.events) {
      toast({
        title: t("crm.noDataToExport"),
        description: t("crm.error"),
        variant: "destructive",
      });
      return;
    }

    // Create statistics summary data with properly translated values
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
      [t('dashboard.category')]: t('dashboard.totalCustomers'),
      [t('dashboard.total')]: data.customerStats?.total || 0,
      [t('dashboard.details')]: `${t('dashboard.withBooking')}: ${data.customerStats?.withBooking || 0}`,
      [t('dashboard.additionalInfo')]: `${t('dashboard.withoutBooking')}: ${data.customerStats?.withoutBooking || 0}`,
    }, {
      [t('dashboard.category')]: '',
      [t('dashboard.total')]: '',
      [t('dashboard.details')]: '',
      [t('dashboard.additionalInfo')]: '',
    }, {
      [t('dashboard.category')]: t('dashboard.financialSummary'),
      [t('dashboard.total')]: t('dashboard.totalIncome'),
      [t('dashboard.details')]: `${currencySymbol}${data.eventStats?.totalIncome?.toFixed(2) || '0.00'}`,
      [t('dashboard.additionalInfo')]: '',
    }, {
      [t('dashboard.category')]: '',
      [t('dashboard.total')]: t('dashboard.fromEvents'),
      [t('dashboard.details')]: `${currencySymbol}${data.eventStats?.eventIncome?.toFixed(2) || '0.00'}`,
      [t('dashboard.additionalInfo')]: '',
    }, {
      [t('dashboard.category')]: '',
      [t('dashboard.total')]: t('dashboard.fromCustomers'),
      [t('dashboard.details')]: `${currencySymbol}${data.eventStats?.standaloneCustomerIncome?.toFixed(2) || '0.00'}`,
      [t('dashboard.additionalInfo')]: t('dashboard.withoutBooking'),
    }];

    // Transform events data for Excel with combined income calculation
    const eventsData = data.eventStats.events.map(event => {
      // Use combined_payment_amount if available (from multi-person calculation), 
      // otherwise fall back to individual payment_amount
      const totalEventIncome = event.combined_payment_amount || event.payment_amount || 0;
      const personCount = event.person_count || 1;
      
      return {
        [t('events.fullNameRequired')]: `${event.title || ''} ${event.user_surname || ''}`.trim(),
        [t('events.phoneNumber')]: event.user_number || '',
        [t('events.socialLinkEmail')]: event.social_network_link || '',
        [t('events.paymentStatus')]: event.payment_status ? (
          event.payment_status === 'not_paid' ? t("crm.notPaid") : 
          event.payment_status === 'partly_paid' ? t("crm.paidPartly") :
          event.payment_status === 'fully_paid' ? t("crm.paidFully") :
          event.payment_status
        ) : '',
        [t('events.paymentAmount')]: totalEventIncome ? `${currencySymbol}${totalEventIncome}` : '',
        [t('events.date')]: event.start_date ? format(new Date(event.start_date), 'dd.MM.yyyy') : '',
        [t('events.time')]: event.start_date && event.end_date ? 
          `${format(new Date(event.start_date), 'HH:mm')} - ${format(new Date(event.end_date), 'HH:mm')}` : '',
        [t('events.eventNotes')]: event.event_notes || '',
        [`${t('dashboard.totalPersons')}`]: personCount,
        [`${t('dashboard.combinedIncome')}`]: totalEventIncome ? `${currencySymbol}${totalEventIncome}` : '',
      };
    });

    // Set Excel metadata in current language
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: t('dashboard.statistics'),
      Subject: t('dashboard.statistics'),
      Author: "SmartBookly",
      CreatedDate: new Date()
    };

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

    // Set events column widths (added 2 more columns for person count and combined income)
    wsEvents['!cols'] = [
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 20 },
      { wch: 40 },
      { wch: 15 }, // Total Persons
      { wch: 18 }, // Combined Income
    ];

    // Generate Excel file with localized filename
    const dateStr = format(new Date(), 'dd-MM-yyyy');
    const fileName = `${t('dashboard.statistics').toLowerCase()}-${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: t("dashboard.exportSuccessful"),
      description: t("dashboard.exportSuccessMessage"),
    });
  }, [toast, t, language, currencySymbol]);

  return { exportToExcel };
};
