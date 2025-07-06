
import { CalendarEventType } from "@/lib/types/calendar";
import { addDays, addWeeks, addMonths, addYears, endOfYear, isBefore, format, getDay, startOfDay } from "date-fns";

export interface RepeatOption {
  value: string;
  label: string;
}

export const getRepeatOptions = (selectedDate?: Date, t?: (key: string, params?: Record<string, string | number>) => string): RepeatOption[] => {
  const options: RepeatOption[] = [
    { value: "none", label: t ? t("recurring.doesNotRepeat") : "Does not repeat" },
    { value: "daily", label: t ? t("recurring.daily") : "Daily" },
  ];

  if (selectedDate && t) {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const georgianWeekdays = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];
    const spanishWeekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    
    const dayIndex = getDay(selectedDate);
    const language = t("recurring.weekly") === "ყოველკვირეულად" ? "ka" : 
                   t("recurring.weekly") === "Semanalmente" ? "es" : "en";
    
    let weekday = weekdays[dayIndex];
    if (language === "ka") {
      weekday = georgianWeekdays[dayIndex];
    } else if (language === "es") {
      weekday = spanishWeekdays[dayIndex];
    }
    
    options.push({ value: "weekly", label: `${t("recurring.weeklyOn")} ${weekday}` });
    options.push({ value: "biweekly", label: `${t("recurring.biweeklyOn")} ${weekday}` });
    
    // Monthly options
    const date = selectedDate.getDate();
    if (language === "ka") {
      options.push({ value: "monthly", label: `${t("recurring.monthlyOnDay")} ${date} ში` });
    } else {
      options.push({ value: "monthly", label: `${t("recurring.monthlyOnDay")} ${date}` });
    }
    
    // Yearly option
    const monthIndex = selectedDate.getMonth();
    const monthKeys = [
      "months.january", "months.february", "months.march", "months.april",
      "months.may", "months.june", "months.july", "months.august",
      "months.september", "months.october", "months.november", "months.december"
    ];
    
    const monthName = t(monthKeys[monthIndex]);
    
    if (language === "ka") {
      // Georgian format: "ყოველწლიურად ივნისის 12"
      const georgianMonthGenitive = monthName + "ის";
      options.push({ value: "yearly", label: `${t("recurring.annuallyOn")} ${georgianMonthGenitive} ${date}` });
    } else {
      options.push({ value: "yearly", label: `${t("recurring.annuallyOn")} ${monthName} ${date}` });
    }
  } else if (selectedDate) {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekday = weekdays[getDay(selectedDate)];
    options.push({ value: "weekly", label: `Weekly on ${weekday}` });
    options.push({ value: "biweekly", label: `Every 2 weeks on ${weekday}` });
    
    // Monthly options
    const date = selectedDate.getDate();
    options.push({ value: "monthly", label: `Monthly on day ${date}` });
    
    // Yearly option
    options.push({ value: "yearly", label: `Annually on ${format(selectedDate, "MMMM d")}` });
  } else {
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
  if (!baseEvent.is_recurring || !baseEvent.repeat_pattern || baseEvent.repeat_pattern === "none") {
    return [baseEvent];
  }

  const instances: CalendarEventType[] = [baseEvent]; // Include the original event
  const startDate = new Date(baseEvent.start_date);
  const endDate = new Date(baseEvent.end_date);
  const eventDuration = endDate.getTime() - startDate.getTime();
  
  // Use repeat_until if provided, otherwise generate instances until end of current year
  const endLimit = baseEvent.repeat_until ? new Date(baseEvent.repeat_until + 'T23:59:59') : endOfYear(startDate);
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
        currentDate = addWeeks(currentDate, 2); // Fixed: was addDays(currentDate, 14), now uses addWeeks for proper biweekly calculation
        break;
      case "monthly":
        currentDate = addMonths(currentDate, 1);
        break;
      case "yearly":
        currentDate = addYears(currentDate, 1);
        break;
      default:
        console.warn(`Unknown repeat pattern: ${baseEvent.repeat_pattern}`);
        return instances; // Unknown pattern, return original
    }

    // Stop if we've exceeded the end limit
    if (!isBefore(currentDate, endLimit)) {
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

  console.log(`Generated ${instances.length} instances for ${baseEvent.repeat_pattern} pattern`);
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
