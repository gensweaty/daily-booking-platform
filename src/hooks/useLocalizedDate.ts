
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedDateFormat, getLocalizedMonthName, getLocalizedWeekdayName } from "@/lib/dateLocalization";

export const useLocalizedDate = () => {
  const { language } = useLanguage();

  const formatDate = (date: Date, formatType: 'full' | 'monthYear' | 'dayMonth' | 'weekOf') => {
    return getLocalizedDateFormat(date, language as 'en' | 'es' | 'ka', formatType);
  };

  const getMonthName = (date: Date) => {
    return getLocalizedMonthName(date, language as 'en' | 'es' | 'ka');
  };

  const getWeekdayName = (date: Date, short: boolean = false, single: boolean = false) => {
    return getLocalizedWeekdayName(date, language as 'en' | 'es' | 'ka', short, single);
  };

  return {
    formatDate,
    getMonthName,
    getWeekdayName,
    language
  };
};
