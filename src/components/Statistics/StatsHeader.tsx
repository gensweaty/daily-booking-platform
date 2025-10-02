
import { Button } from "../ui/button";
import { FileSpreadsheet } from "lucide-react";
import { DateRangeSelect } from "./DateRangeSelect";
import { memo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { GeorgianAuthText } from "../shared/GeorgianAuthText";

interface StatsHeaderProps {
  dateRange: { start: Date; end: Date };
  onDateChange: (start: Date, end: Date | null) => void;
  onExport: () => void;
  isLoading?: boolean;
}

export const StatsHeader = memo(({ dateRange, onDateChange, onExport, isLoading }: StatsHeaderProps) => {
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
      <DateRangeSelect 
        selectedDate={dateRange}
        onDateChange={handleDateChange}
        disabled={isLoading}
      />
      <Button
        variant="info"
        onClick={onExport}
        className={cn(
          "sm:-mt-4 rounded-md flex items-center gap-2",
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
    </div>
  );
});

StatsHeader.displayName = 'StatsHeader';
