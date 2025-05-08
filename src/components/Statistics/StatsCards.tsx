
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
    currencyType?: string; // Add support for currency type
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
  
  // Determine the currency to display - use event currency if available, otherwise use language
  const displayCurrency = eventStats.currencyType || language;
  
  // Get the appropriate currency symbol based on currency type or fallback to language
  const currencySymbol = getCurrencySymbol(displayCurrency as any);

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

  // Format the income value to have 2 decimal places and add currency symbol
  const formattedIncome = `${currencySymbol}${(validTotalIncome || 0).toFixed(2)}`;
  
  // Choose the appropriate currency icon based on display currency
  const CurrencyIcon = displayCurrency === 'es' ? EuroIcon : 
                       displayCurrency === 'ka' ? BanknoteIcon : DollarSign;
  
  // Enhanced debugging to verify income data at every step
  console.log("StatsCards - Rendering with income data:", {
    rawIncome: eventStats.totalIncome,
    rawIncomeType: typeof eventStats.totalIncome,
    afterParsing: validTotalIncome,
    formattedIncome,
    currency: currencySymbol,
    displayCurrency,
    eventCurrency: eventStats.currencyType
  });

  // Format the task details to show completed, in progress, and todo
  const taskDetailsText = `${taskStats.completed} ${t("dashboard.completed")}, ${taskStats.inProgress} ${t("dashboard.inProgress")}, ${taskStats.todo} ${t("dashboard.todo")}`;

  // Format the customer details text using proper translations
  // Using separate translation keys for "with booking" and "without booking"
  const withBookingText = t("dashboard.withBooking");
  const withoutBookingText = t("dashboard.withoutBooking");
  const customerDetailsText = `${customerStats.withBooking} ${withBookingText}, ${customerStats.withoutBooking} ${withoutBookingText}`;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard
        title={t("dashboard.totalTasks")}
        value={taskStats.total}
        description={taskDetailsText}
        icon={CheckCircle2}
        color="purple"
      />
      <StatCard
        title={t("dashboard.totalCustomers")}
        value={customerStats.total}
        description={customerDetailsText}
        icon={Users}
        color="orange"
      />
      <StatCard
        title={t("dashboard.totalEvents")}
        value={eventStats.total}
        description={`${eventStats.partlyPaid} ${t("dashboard.partlyPaid")}, ${eventStats.fullyPaid} ${t("dashboard.fullyPaid")}`}
        icon={CalendarCheck}
        color="green"
      />
      <StatCard
        title={t("dashboard.totalIncome")}
        value={formattedIncome}
        description={t("dashboard.fromAllEvents")}
        icon={CurrencyIcon}
        valueClassName="text-2xl"
        color="blue"
      />
    </div>
  );
};
