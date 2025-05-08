
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { getCurrencySymbol, formatCurrency } from "@/lib/currency";

interface StatsCardsProps {
  taskStats: any;
  eventStats: any;
  customerStats: any;
}

export const StatsCards = ({ taskStats, eventStats, customerStats }: StatsCardsProps) => {
  const { language } = useLanguage();
  
  // Ensure totalIncome is a valid number
  const totalIncome = typeof eventStats?.totalIncome === 'number' ? 
    eventStats.totalIncome : 
    0;
  
  console.log("StatsCards - totalIncome:", totalIncome, "type:", typeof totalIncome);
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <LanguageText>stats.totalTasks</LanguageText>
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{taskStats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            <LanguageText>stats.completedTasks</LanguageText>: {taskStats?.completed || 0}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <LanguageText>stats.totalBookings</LanguageText>
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M8 12h8M12 8v8" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{eventStats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            <LanguageText>stats.paidBookings</LanguageText>: {(eventStats?.fullyPaid || 0) + (eventStats?.partlyPaid || 0)}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <LanguageText>stats.totalIncome</LanguageText>
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalIncome, language)}
          </div>
          <p className="text-xs text-muted-foreground">
            <LanguageText>stats.from</LanguageText> {eventStats?.fullyPaid || 0} <LanguageText>stats.fullyPaid</LanguageText>
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <LanguageText>stats.totalCustomers</LanguageText>
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{customerStats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            <LanguageText>stats.withBooking</LanguageText>: {customerStats?.withBooking || 0}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
