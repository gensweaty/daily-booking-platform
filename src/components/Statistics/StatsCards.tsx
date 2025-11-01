import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    previousPeriod?: { total: number };
  };
  eventStats: {
    total: number;
    partlyPaid: number;
    fullyPaid: number;
    totalIncome: number | string | null | undefined;
    eventIncome?: number;
    standaloneCustomerIncome?: number;
    previousPeriod?: { total: number; totalIncome: number };
  };
  customerStats: {
    total: number;
    withBooking: number;
    withoutBooking: number;
    previousPeriod?: { total: number };
  };
}

export const StatsCards = ({ taskStats, eventStats, customerStats }: StatsCardsProps) => {
  const { t, language } = useLanguage();
  
  // Calculate dynamic trends
  const calculateTrend = (current: number, previous: number | undefined): string => {
    if (!previous || previous === 0) return '+0%';
    const change = ((current - previous) / previous) * 100;
    return `${change > 0 ? '+' : ''}${Math.round(change)}%`;
  };

  const taskTrend = taskStats?.previousPeriod ? calculateTrend(taskStats.total, taskStats.previousPeriod.total) : '+0%';
  const customerTrend = customerStats?.previousPeriod ? calculateTrend(customerStats.total, customerStats.previousPeriod.total) : '+0%';
  const eventTrend = eventStats?.previousPeriod ? calculateTrend(eventStats.total, eventStats.previousPeriod.total) : '+0%';
  const incomeTrend = eventStats?.previousPeriod ? calculateTrend(parseFloat(String(eventStats.totalIncome || 0)), eventStats.previousPeriod.totalIncome) : '+0%';
  
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
        trend={taskTrend}
      />
      <StatCard
        title={t("dashboard.totalCustomers")}
        value={customerStats.total}
        description={customerDetailsText}
        icon={Users}
        color="orange"
        trend={customerTrend}
        trendLabel={t("dashboard.currentMonth")}
      />
      <StatCard
        title={t("dashboard.totalEvents")}
        value={eventStats.total}
        description={`${eventStats.partlyPaid} ${t("dashboard.partlyPaid")}, ${eventStats.fullyPaid} ${t("dashboard.fullyPaid")}, ${notPaidCount} ${t("dashboard.notPaid")}`}
        icon={CalendarCheck}
        color="green"
        trend={eventTrend}
        trendLabel={t("dashboard.currentMonth")}
      />
      <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-blue-200/50 dark:border-blue-800/50">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-400/5 dark:to-purple-400/5" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 dark:from-blue-400/0 dark:to-purple-400/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 dark:group-hover:from-blue-400/10 dark:group-hover:to-purple-400/10 transition-all duration-500" />
        
        <CardHeader className="relative flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("dashboard.totalIncome")}
          </CardTitle>
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-400/10 dark:to-purple-400/10 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-blue-200/30 dark:border-blue-700/30">
            <CurrencyIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        
        <CardContent className="relative">
          <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-3">
            {formattedTotalIncome}
          </div>
          
          {validStandaloneIncome > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarCheck className="h-3 w-3" />
                  {t("dashboard.fromEvents")}
                </span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{formattedEventIncome}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t("dashboard.fromCustomers")}
                </span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{formattedStandaloneIncome}</span>
              </div>
              <div className="relative h-2 bg-muted rounded-full overflow-hidden mt-3">
                <div 
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 transition-all duration-500"
                  style={{ width: `${(validEventIncome / validTotalIncome) * 100}%` }}
                />
                <div 
                  className="absolute right-0 top-0 h-full bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 transition-all duration-500"
                  style={{ width: `${(validStandaloneIncome / validTotalIncome) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("dashboard.fromAllEvents")}</p>
          )}
          
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="text-green-600 dark:text-green-400 font-medium">{incomeTrend}</span>
            <span className="text-muted-foreground">{t("dashboard.currentMonth")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
