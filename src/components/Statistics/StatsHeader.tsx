
import { Button } from "../ui/button";
import { FileSpreadsheet } from "lucide-react";
import { DateRangeSelect } from "./DateRangeSelect";
import { memo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";
import { PresenceCircles } from "../presence/PresenceCircles";

interface StatsHeaderProps {
  dateRange: { start: Date; end: Date };
  onDateChange: (start: Date, end: Date | null) => void;
  onExport: () => void;
  isLoading?: boolean;
  onlineUsers?: Array<{ email?: string | null; name?: string | null; avatar_url?: string | null; online_at?: string | null }>;
  currentUserEmail?: string;
}

export const StatsHeader = memo(({ dateRange, onDateChange, onExport, isLoading, onlineUsers = [], currentUserEmail }: StatsHeaderProps) => {
  // Wrapped in useCallback to ensure stable reference
  const handleDateChange = useCallback((start: Date, end: Date | null) => {
    onDateChange(start, end || start);
  }, [onDateChange]);

  const { language, t } = useLanguage();
  const isGeorgian = language === 'ka';

  // Get button text with fallback
  const getButtonText = () => {
    try {
      return t('analytics.exportToExcel');
    } catch {
      // Fallback in case translation is not ready
      return language === 'es' ? 'Exportar a Excel' : 
             language === 'ka' ? 'Excel-ში ექსპორტი' : 
             'Export to Excel';
    }
  };

  const buttonText = getButtonText();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
      <div className="flex items-center gap-2">
        <DateRangeSelect 
          selectedDate={dateRange}
          onDateChange={handleDateChange}
          disabled={isLoading}
        />
        <Button
          variant="info"
          onClick={onExport}
          className={cn(
            "rounded-md flex items-center gap-2",
            isGeorgian && "font-georgian"
          )}
          disabled={isLoading}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {isGeorgian ? (
            <GeorgianAuthText>{buttonText}</GeorgianAuthText>
          ) : (
            <span>{buttonText}</span>
          )}
        </Button>
        {onlineUsers.length > 0 && (
          <div className="ml-2">
            <PresenceCircles users={onlineUsers} max={5} currentUserEmail={currentUserEmail} />
          </div>
        )}
      </div>
    </div>
  );
});

StatsHeader.displayName = 'StatsHeader';
