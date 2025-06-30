
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
  const deletedDates = new Set(
    deletionExceptions
      .filter(exception => exception.type === 'deleted_exception')
      .map(exception => exception.start_date.split('T')[0])
  );
  
  return instances.filter(instance => {
    const instanceDate = instance.start_date.split('T')[0];
    return !deletedDates.has(instanceDate);
  });
};

export const isVirtualInstance = (eventId: string): boolean => {
  // Check if the ID ends with a date pattern (YYYY-MM-DD)
  const datePattern = /\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(eventId);
};

export const getParentEventId = (eventId: string): string => {
  if (!isVirtualInstance(eventId)) {
    return eventId;
  }
  
  // For virtual instances, remove the date suffix to get parent ID
  // Pattern: "uuid-YYYY-MM-DD" -> "uuid"
  const datePattern = /-\d{4}-\d{2}-\d{2}$/;
  return eventId.replace(datePattern, '');
};

export const getInstanceDate = (eventId: string): string | null => {
  if (!isVirtualInstance(eventId)) {
    return null;
  }
  
  // Extract the date part from virtual instance ID
  const match = eventId.match(/(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
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
