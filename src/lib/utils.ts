
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isSameDay as dateFnsIsSameDay } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date using date-fns format
 * @param date The date to format
 * @param formatStr Optional format string (defaults to 'PPP')
 * @returns Formatted date string
 */
export function formatDate(date: Date | null | undefined, formatStr = "PPP"): string {
  if (!date) return "Select a date";
  
  try {
    // Handle cases when today
    if (isToday(date)) {
      return `Today, ${format(date, formatStr)}`;
    }
    
    return format(date, formatStr);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
}

/**
 * Checks if two dates are the same day
 * @param dateLeft First date to compare
 * @param dateRight Second date to compare
 * @returns Whether the dates are the same day
 */
export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean {
  return dateFnsIsSameDay(dateLeft, dateRight);
}
