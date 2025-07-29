import { CalendarEventType } from "@/lib/types/calendar";
import { addDays, addWeeks, addMonths, addYears, endOfYear, isBefore, format, getDay, startOfDay } from "date-fns";

export interface RepeatOption {
  value: string;
  label: string;
}

// Day and month arrays for each language
const daysEN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const daysKA = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
const daysES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const monthsEN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthsKA = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const monthsES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const getRepeatOptions = (selectedDate?: Date, t?: (key: string, params?: Record<string, string | number>) => string): RepeatOption[] => {
  const options: RepeatOption[] = [
    { value: "none", label: t ? t("recurring.doesNotRepeat") : "Does not repeat" },
    { value: "daily", label: t ? t("recurring.daily") : "Daily" },
  ];

  if (selectedDate && t) {
    const weekdayIdx = getDay(selectedDate);
    const dayOfMonth = selectedDate.getDate();
    const monthIdx = selectedDate.getMonth();

    // Determine language based on translation
    const language = t("recurring.weekly") === "ყოველკვირეულად" ? "ka" : 
                   t("recurring.weekly") === "Semanal" ? "es" : "en";
    
    const dayLabel = { en: daysEN, ka: daysKA, es: daysES }[language][weekdayIdx];
    const monthLabel = { en: monthsEN, ka: monthsKA, es: monthsES }[language][monthIdx];

    // Use translation keys with parameters for dynamic options
    options.push(
      { 
        value: "weekly", 
        label: t("recurring.weeklyOn", { day: dayLabel })
      },
      { 
        value: "biweekly", 
        label: t("recurring.biweeklyOn", { day: dayLabel })
      },
      { 
        value: "monthly", 
        label: t("recurring.monthlyOnDay", { day: dayOfMonth })
      },
      { 
        value: "yearly", 
        label: t("recurring.annuallyOn", { month: monthLabel, day: dayOfMonth })
      }
    );
  } else if (selectedDate) {
    // Fallback without translation function
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekday = weekdays[getDay(selectedDate)];
    const date = selectedDate.getDate();
    
    options.push(
      { value: "weekly", label: `Weekly on ${weekday}` },
      { value: "biweekly", label: `Every 2 weeks on ${weekday}` },
      { value: "monthly", label: `Monthly on day ${date}` },
      { value: "yearly", label: `Annually on ${format(selectedDate, "MMMM d")}` }
    );
  } else {
    // Generic options without specific date
    if (t) {
      options.push(
        { value: "weekly", label: t("recurring.weekly") },
        { value: "biweekly", label: t("recurring.biweekly") },
        { value: "monthly", label: t("recurring.monthly") },
        { value: "yearly", label: t("recurring.yearly") }
      );
    } else {
      options.push(
        { value: "weekly", label: "Weekly" },
        { value: "biweekly", label: "Every 2 weeks" },
        { value: "monthly", label: "Monthly" },
        { value: "yearly", label: "Yearly" }
      );
    }
  }

  return options;
};

export const generateRecurringInstances = (baseEvent: CalendarEventType): CalendarEventType[] => {
  if (!baseEvent.is_recurring || !baseEvent.repeat_pattern) {
    return [baseEvent];
  }

  const instances: CalendarEventType[] = [baseEvent]; // Include the original event
  const startDate = new Date(baseEvent.start_date);
  const endDate = new Date(baseEvent.end_date);
  const eventDuration = endDate.getTime() - startDate.getTime();
  
  // Generate instances until end of current year only
  const yearEnd = endOfYear(startDate);
  let currentDate = new Date(startDate);

  // Limit to prevent infinite loops
  let iterationCount = 0;
  const maxIterations = 365; // Safety limit

  while (iterationCount < maxIterations) {
    iterationCount++;
    
    // Calculate next occurrence based on repeat pattern
    switch (baseEvent.repeat_pattern) {
      case "daily":
        currentDate = addDays(currentDate, 1);
        break;
      case "weekly":
        currentDate = addWeeks(currentDate, 1);
        break;
      case "biweekly":
        currentDate = addWeeks(currentDate, 2);
        break;
      case "monthly":
        currentDate = addMonths(currentDate, 1);
        break;
      case "yearly":
        currentDate = addYears(currentDate, 1);
        break;
      default:
        return instances; // Unknown pattern, return original
    }

    // Stop if we've exceeded the year boundary
    if (!isBefore(currentDate, yearEnd)) {
      break;
    }

    // Create virtual instance
    const instanceEndDate = new Date(currentDate.getTime() + eventDuration);
    const virtualInstance: CalendarEventType = {
      ...baseEvent,
      id: `${baseEvent.id}-${format(currentDate, "yyyy-MM-dd")}`, // Virtual ID
      start_date: currentDate.toISOString(),
      end_date: instanceEndDate.toISOString(),
      // Mark as virtual instance for special handling
      parent_event_id: baseEvent.id,
    };

    instances.push(virtualInstance);
  }

  return instances;
};

export const filterDeletedInstances = (instances: CalendarEventType[], deletionExceptions: CalendarEventType[]): CalendarEventType[] => {
  console.log("🔍 Filtering deleted instances:", {
    instancesCount: instances.length,
    exceptionsCount: deletionExceptions.length
  });

  // Create a set of deleted dates from deletion exceptions
  // Look for our special deletion markers
  const deletedDates = new Set(
    deletionExceptions
      .filter(exception => {
        // Look for our special deletion markers
        const isDeletionException = exception.type === 'deletion_exception' || 
                                   (exception.title && exception.title.startsWith('__DELETED_')) ||
                                   (exception.user_surname === '__SYSTEM_DELETION_EXCEPTION__');
        
        console.log("🚫 Checking exception:", {
          id: exception.id,
          title: exception.title,
          type: exception.type,
          user_surname: exception.user_surname,
          isDeletionException,
          startDate: exception.start_date
        });
        
        return isDeletionException;
      })
      .map(exception => {
        const dateStr = exception.start_date.split('T')[0];
        console.log("📅 Adding deleted date:", dateStr);
        return dateStr;
      })
  );
  
  console.log("🗑️ Deleted dates set:", Array.from(deletedDates));
  
  // Filter out instances that match deleted dates
  const filteredInstances = instances.filter(instance => {
    const instanceDate = instance.start_date.split('T')[0];
    const isDeleted = deletedDates.has(instanceDate);
    
    if (isDeleted) {
      console.log("❌ Filtering out deleted instance:", {
        id: instance.id,
        title: instance.title,
        date: instanceDate
      });
    }
    
    return !isDeleted;
  });
  
  console.log("✅ Filtered instances:", {
    original: instances.length,
    filtered: filteredInstances.length,
    removed: instances.length - filteredInstances.length
  });
  
  return filteredInstances;
};

export const isVirtualInstance = (eventId: string): boolean => {
  // Check if the ID contains a date pattern (YYYY-MM-DD)
  const hasDatePattern = /\d{4}-\d{2}-\d{2}$/.test(eventId);
  console.log("🔍 Checking if virtual instance:", { eventId, hasDatePattern });
  return hasDatePattern;
};

export const getParentEventId = (eventId: string): string => {
  if (!isVirtualInstance(eventId)) {
    console.log("📋 Not a virtual instance, returning original ID:", eventId);
    return eventId;
  }
  
  // For virtual instances, remove the date suffix to get parent ID
  // Pattern: "uuid-YYYY-MM-DD" -> "uuid"
  const datePattern = /-\d{4}-\d{2}-\d{2}$/;
  const parentId = eventId.replace(datePattern, '');
  
  console.log("👨‍👩‍👧‍👦 Extracted parent ID:", { originalId: eventId, parentId });
  return parentId;
};

export const getInstanceDate = (eventId: string): string | null => {
  if (!isVirtualInstance(eventId)) {
    console.log("📋 Not a virtual instance, no date to extract:", eventId);
    return null;
  }
  
  // Extract the date part from virtual instance ID
  const match = eventId.match(/(\d{4}-\d{2}-\d{2})$/);
  const instanceDate = match ? match[1] : null;
  
  console.log("📅 Extracted instance date:", { eventId, instanceDate });
  return instanceDate;
};

export const parseRepeatPattern = (pattern: string): string => {
  switch (pattern) {
    case "daily": return "daily";
    case "weekly": return "weekly";
    case "biweekly": return "biweekly";
    case "monthly": return "monthly";
    case "yearly": return "yearly";
    default: return "none";
  }
};
