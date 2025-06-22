
import { CalendarEventType } from "@/lib/types/calendar";
import { addDays, addWeeks, addMonths, addYears, endOfYear, isBefore, format, getDay, startOfDay } from "date-fns";

export interface RepeatOption {
  value: string;
  label: string;
}

export const getRepeatOptions = (selectedDate?: Date): RepeatOption[] => {
  const options: RepeatOption[] = [
    { value: "none", label: "Does not repeat" },
    { value: "daily", label: "Daily" },
  ];

  if (selectedDate) {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekday = weekdays[getDay(selectedDate)];
    options.push({ value: "weekly", label: `Weekly on ${weekday}` });
    options.push({ value: "biweekly", label: `Every 2 weeks on ${weekday}` });
    
    // Monthly options
    const date = selectedDate.getDate();
    const month = format(selectedDate, "MMMM");
    options.push({ value: "monthly", label: `Monthly on day ${date}` });
    
    // Yearly option
    options.push({ value: "yearly", label: `Annually on ${format(selectedDate, "MMMM d")}` });
  } else {
    options.push(
      { value: "weekly", label: "Weekly" },
      { value: "biweekly", label: "Every 2 weeks" },
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly" }
    );
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

export const isVirtualInstance = (eventId: string): boolean => {
  return eventId.includes("-") && eventId.match(/\d{4}-\d{2}-\d{2}$/);
};

export const getParentEventId = (eventId: string): string => {
  if (isVirtualInstance(eventId)) {
    return eventId.split("-").slice(0, -3).join("-"); // Remove the date suffix
  }
  return eventId;
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
