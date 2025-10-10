import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatCard } from "./StatCard";
import {
  CheckCircle2,
  Users,
  CalendarCheck,
  DollarSign,
  EuroIcon,
  BanknoteIcon,
} from "lucide-react";
import { LanguageText } from "@/components/shared/LanguageText";
import { getCurrencySymbol, parsePaymentAmount } from "@/lib/currency";

interface StatsCardsProps {
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
    totalIncome: number | string | null | undefined;
    eventIncome?: number;
    standaloneCustomerIncome?: number;
  };
  customerStats: {
    total: number;
    withBooking: number;
    withoutBooking: number;
  };
}

export const StatsCards = ({ taskStats, eventStats, customerStats }: StatsCardsProps) => {
  const { t, language } = useLanguage();
  
  // Early return with warning if eventStats is missing entirely
  if (!eventStats) {
    console.warn("StatsCards: eventStats is missing or undefined");
    return null;
  }
  
  // Get the appropriate currency symbol based on language
  const currencySymbol = getCurrencySymbol(language);

  // Ensure totalIncome is a valid number - use fallback to 0 if invalid or undefined
  let validTotalIncome = 0;
  
  if (eventStats.totalIncome === undefined || eventStats.totalIncome === null) {
    console.warn("StatsCards: totalIncome is null or undefined, using default 0");
  } else {
    // Use our shared utility function to parse the payment amount
    validTotalIncome = parsePaymentAmount(eventStats.totalIncome);
    
    // Additional validation to ensure we have a number
    if (isNaN(validTotalIncome) || !isFinite(validTotalIncome)) {
      console.error("StatsCards: Invalid number after parsing:", eventStats.totalIncome);
      validTotalIncome = 0;
    }
  }

  // Parse separate income values
  const validEventIncome = parsePaymentAmount(eventStats.eventIncome || 0);
  const validStandaloneIncome = parsePaymentAmount(eventStats.standaloneCustomerIncome || 0);
  
  // Format the income values
  const formattedTotalIncome = `${currencySymbol}${(validTotalIncome || 0).toFixed(2)}`;
  const formattedEventIncome = `${currencySymbol}${(validEventIncome || 0).toFixed(2)}`;
  const formattedStandaloneIncome = `${currencySymbol}${(validStandaloneIncome || 0).toFixed(2)}`;
  
  // Choose the appropriate currency icon based on language
  const CurrencyIcon = language === 'es' ? EuroIcon : 
                       language === 'ka' ? BanknoteIcon : DollarSign;
  
  // Create description with breakdown
  const incomeDescription = validStandaloneIncome > 0 
    ? `${t("dashboard.fromEvents")}: ${formattedEventIncome} • ${t("dashboard.fromCustomers")}: ${formattedStandaloneIncome}`
    : t("dashboard.fromAllEvents");
  
  // Enhanced debugging to verify income data at every step
  console.log("StatsCards - Rendering with income data:", {
    rawIncome: eventStats.totalIncome,
    rawIncomeType: typeof eventStats.totalIncome,
    afterParsing: validTotalIncome,
    formattedTotalIncome,
    currency: currencySymbol
  });

  // Format the task details to show completed, in progress, and todo
  const taskDetailsText = `${taskStats.completed} ${t("dashboard.completed")}, ${taskStats.inProgress} ${t("dashboard.inProgress")}, ${taskStats.todo} ${t("dashboard.todo")}`;

  // Format the customer details text using proper translations
  // Using separate translation keys for "with booking" and "without booking"
  const withBookingText = t("dashboard.withBooking");
  const withoutBookingText = t("dashboard.withoutBooking");
  const customerDetailsText = `${customerStats.withBooking} ${withBookingText}, ${customerStats.withoutBooking} ${withoutBookingText}`;
  const notPaidCount = Math.max(0, (eventStats.total || 0) - (eventStats.partlyPaid || 0) - (eventStats.fullyPaid || 0));

  return (
    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title={t("dashboard.totalTasks")}
        value={taskStats.total}
        description={taskDetailsText}
        icon={CheckCircle2}
        color="purple"
        trend="+12%"
      />
      <StatCard
        title={t("dashboard.totalCustomers")}
        value={customerStats.total}
        description={customerDetailsText}
        icon={Users}
        color="orange"
        trend="+8%"
        trendLabel={t("dashboard.currentMonth")}
      />
      <StatCard
        title={t("dashboard.totalEvents")}
        value={eventStats.total}
        description={`${eventStats.partlyPaid} ${t("dashboard.partlyPaid")}, ${eventStats.fullyPaid} ${t("dashboard.fullyPaid")}, ${notPaidCount} ${t("dashboard.notPaid")}`}
        icon={CalendarCheck}
        color="green"
        trend="+23%"
        trendLabel={t("dashboard.currentMonth")}
      />
      <StatCard
        title={t("dashboard.totalIncome")}
        value={formattedTotalIncome}
        description={incomeDescription}
        icon={CurrencyIcon}
        valueClassName="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent"
        color="blue"
        trend="+15%"
        trendLabel={t("dashboard.currentMonth")}
      />
    </div>
  );
};
