
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedDateFormat, getLocalizedMonthName, getLocalizedWeekdayName } from "@/lib/dateLocalization";

export const useLocalizedDate = () => {
  const { language } = useLanguage();

  const formatDate = (date: Date, formatType: 'full' | 'monthYear' | 'dayMonth' | 'weekOf') => {
    return getLocalizedDateFormat(date, language, formatType);
  };

  const getMonthName = (date: Date) => {
    return getLocalizedMonthName(date, language);
  };

  const getWeekdayName = (date: Date, short: boolean = false, single: boolean = false) => {
    return getLocalizedWeekdayName(date, language, short, single);
  };

  return {
    formatDate,
    getMonthName,
    getWeekdayName,
    language
  };
};
