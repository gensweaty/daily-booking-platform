
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isSameDay as fnsIsSameDay } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date with optional language support
 * @param date The date to format
 * @param language The language code (en, es, ka)
 * @returns Formatted date string
 */
export function formatDate(date: Date, language: string = 'en'): string {
  try {
    // Check if date is today
    const today = new Date();
    const isToday = fnsIsSameDay(date, today);
    
    // Get "Today" prefix based on language
    const todayText = {
      'en': 'Today',
      'es': 'Hoy',
      'ka': 'დღეს',
    }[language] || 'Today';
    
    // Format the date
    const formattedDate = format(date, 'MMM dd, yyyy');
    
    // Return with "Today" prefix if it's today
    return isToday ? `${todayText}, ${formattedDate}` : formattedDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(date);
  }
}

/**
 * Check if two dates are on the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if both dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return fnsIsSameDay(date1, date2);
}
