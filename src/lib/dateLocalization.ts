
import { format } from "date-fns";
import { Language } from "@/translations/types";

// Georgian month names (nominative case)
export const georgianMonths = [
  "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
  "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"
];

// Georgian weekday names (full)
export const georgianWeekdays = [
  "კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"
];

// Georgian weekday abbreviations (3 letters)
export const georgianWeekdaysShort = [
  "კვი", "ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ"
];

// Georgian weekday single letters
export const georgianWeekdaysSingle = [
  "კ", "ო", "ს", "ო", "ხ", "პ", "შ"
];

// Spanish month names
export const spanishMonths = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Spanish weekday names
export const spanishWeekdays = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
];

// Spanish weekday abbreviations
export const spanishWeekdaysShort = [
  "Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"
];

export const getLocalizedMonthName = (date: Date, language: Language): string => {
  const monthIndex = date.getMonth();
  
  switch (language) {
    case 'ka':
      return georgianMonths[monthIndex];
    case 'es':
      return spanishMonths[monthIndex];
    default:
      return format(date, "MMMM");
  }
};

export const getLocalizedWeekdayName = (date: Date, language: Language, short: boolean = false, single: boolean = false): string => {
  const dayIndex = date.getDay();
  
  switch (language) {
    case 'ka':
      if (single) return georgianWeekdaysSingle[dayIndex];
      if (short) return georgianWeekdaysShort[dayIndex];
      return georgianWeekdays[dayIndex];
    case 'es':
      if (single) return spanishWeekdaysShort[dayIndex].charAt(0);
      if (short) return spanishWeekdaysShort[dayIndex];
      return spanishWeekdays[dayIndex];
    default:
      if (single) return format(date, "EEEEE");
      if (short) return format(date, "EEE");
      return format(date, "EEEE");
  }
};

export const getLocalizedDateFormat = (date: Date, language: Language, formatType: 'full' | 'monthYear' | 'dayMonth' | 'weekOf'): string => {
  switch (language) {
    case 'ka':
      switch (formatType) {
        case 'full':
          return `${getLocalizedWeekdayName(date, language)}, ${getLocalizedMonthName(date, language)} ${date.getDate()}, ${date.getFullYear()}`;
        case 'monthYear':
          return `${getLocalizedMonthName(date, language)} ${date.getFullYear()}`;
        case 'dayMonth':
          return `${getLocalizedMonthName(date, language)} ${date.getDate()}`;
        case 'weekOf':
          return `კვირა ${getLocalizedMonthName(date, language)} ${date.getDate()}, ${date.getFullYear()}`;
        default:
          return format(date, "PPP");
      }
    case 'es':
      switch (formatType) {
        case 'full':
          return `${getLocalizedWeekdayName(date, language)}, ${date.getDate()} de ${getLocalizedMonthName(date, language)} de ${date.getFullYear()}`;
        case 'monthYear':
          return `${getLocalizedMonthName(date, language)} ${date.getFullYear()}`;
        case 'dayMonth':
          return `${date.getDate()} ${getLocalizedMonthName(date, language)}`;
        case 'weekOf':
          return `Semana del ${date.getDate()} de ${getLocalizedMonthName(date, language)}, ${date.getFullYear()}`;
        default:
          return format(date, "PPP");
      }
    default:
      switch (formatType) {
        case 'full':
          return format(date, "EEEE, MMMM d, yyyy");
        case 'monthYear':
          return format(date, "MMMM yyyy");
        case 'dayMonth':
          return format(date, "MMM d");
        case 'weekOf':
          return format(date, "MMM d, yyyy");
        default:
          return format(date, "PPP");
      }
  }
};
