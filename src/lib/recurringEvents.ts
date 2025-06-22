
import { addDays, addWeeks, addMonths, addYears, format, getDay, startOfYear, endOfYear, isBefore, isAfter, getDate, setDate, lastDayOfMonth, getWeek, startOfWeek, endOfWeek } from 'date-fns';

export interface RecurringPattern {
  type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  weekday?: number; // 0-6 for Sunday-Saturday
  monthlyType?: 'date' | 'weekday' | 'last-weekday';
  nthWeekday?: number; // 1-4 for first, second, third, fourth
}

export interface RecurringEventInstance {
  id: string;
  start_date: string;
  end_date: string;
  isRecurringInstance: true;
  parentEventId: string;
  instanceDate: string;
}

export const parseRecurringPattern = (pattern: string | null): RecurringPattern => {
  if (!pattern) return { type: 'none' };
  
  try {
    return JSON.parse(pattern);
  } catch {
    return { type: 'none' };
  }
};

export const createRecurringPattern = (
  type: RecurringPattern['type'],
  startDate: Date,
  options?: Partial<RecurringPattern>
): RecurringPattern => {
  const pattern: RecurringPattern = { type, ...options };
  
  switch (type) {
    case 'weekly':
      pattern.weekday = getDay(startDate);
      break;
    case 'monthly':
      pattern.monthlyType = 'date';
      break;
    case 'yearly':
      break;
  }
  
  return pattern;
};

export const generateRecurringInstances = (
  baseEvent: any,
  pattern: RecurringPattern,
  repeatUntil: Date
): RecurringEventInstance[] => {
  if (pattern.type === 'none') return [];
  
  const instances: RecurringEventInstance[] = [];
  const startDate = new Date(baseEvent.start_date);
  const endDate = new Date(baseEvent.end_date);
  const duration = endDate.getTime() - startDate.getTime();
  
  // Limit to end of current year
  const yearEnd = endOfYear(new Date());
  const maxDate = isBefore(repeatUntil, yearEnd) ? repeatUntil : yearEnd;
  
  let currentDate = new Date(startDate);
  let instanceCount = 0;
  const maxInstances = 365; // Safety limit
  
  while (instanceCount < maxInstances && isBefore(currentDate, maxDate)) {
    // Generate next occurrence based on pattern
    switch (pattern.type) {
      case 'daily':
        currentDate = addDays(currentDate, pattern.interval || 1);
        break;
        
      case 'weekly':
        currentDate = addWeeks(currentDate, pattern.interval || 1);
        break;
        
      case 'monthly':
        if (pattern.monthlyType === 'date') {
          currentDate = addMonths(currentDate, pattern.interval || 1);
        } else if (pattern.monthlyType === 'weekday' && pattern.nthWeekday) {
          currentDate = getNthWeekdayOfMonth(currentDate, pattern.weekday!, pattern.nthWeekday);
        } else if (pattern.monthlyType === 'last-weekday') {
          currentDate = getLastWeekdayOfMonth(currentDate, pattern.weekday!);
        }
        break;
        
      case 'yearly':
        currentDate = addYears(currentDate, pattern.interval || 1);
        break;
    }
    
    if (isBefore(currentDate, maxDate)) {
      const instanceEndDate = new Date(currentDate.getTime() + duration);
      
      instances.push({
        id: `${baseEvent.id}-${format(currentDate, 'yyyy-MM-dd')}`,
        start_date: currentDate.toISOString(),
        end_date: instanceEndDate.toISOString(),
        isRecurringInstance: true,
        parentEventId: baseEvent.id,
        instanceDate: format(currentDate, 'yyyy-MM-dd')
      });
    }
    
    instanceCount++;
  }
  
  return instances;
};

const getNthWeekdayOfMonth = (date: Date, weekday: number, nth: number): Date => {
  const month = date.getMonth();
  const year = date.getFullYear();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = getDay(firstOfMonth);
  
  let targetDate = 1 + (weekday - firstWeekday + 7) % 7;
  targetDate += (nth - 1) * 7;
  
  return addMonths(new Date(year, month, targetDate), 1);
};

const getLastWeekdayOfMonth = (date: Date, weekday: number): Date => {
  const month = date.getMonth();
  const year = date.getFullYear();
  const lastOfMonth = lastDayOfMonth(new Date(year, month, 1));
  const lastWeekday = getDay(lastOfMonth);
  
  let daysBack = (lastWeekday - weekday + 7) % 7;
  return addMonths(new Date(lastOfMonth.getTime() - daysBack * 24 * 60 * 60 * 1000), 1);
};

export const getRecurringPatternDescription = (pattern: RecurringPattern, startDate: Date): string => {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ordinals = ['first', 'second', 'third', 'fourth', 'last'];
  
  switch (pattern.type) {
    case 'none':
      return 'Does not repeat';
    case 'daily':
      return pattern.interval === 1 ? 'Daily' : `Every ${pattern.interval} days`;
    case 'weekly':
      const weekday = weekdays[pattern.weekday || getDay(startDate)];
      return pattern.interval === 1 ? `Weekly on ${weekday}` : `Every ${pattern.interval} weeks on ${weekday}`;
    case 'monthly':
      if (pattern.monthlyType === 'date') {
        return `Monthly on the ${getDate(startDate)}${getOrdinalSuffix(getDate(startDate))}`;
      } else if (pattern.monthlyType === 'weekday') {
        const weekday = weekdays[pattern.weekday || getDay(startDate)];
        const nth = ordinals[pattern.nthWeekday! - 1];
        return `Monthly on the ${nth} ${weekday}`;
      } else if (pattern.monthlyType === 'last-weekday') {
        const weekday = weekdays[pattern.weekday || getDay(startDate)];
        return `Monthly on the last ${weekday}`;
      }
      return 'Monthly';
    case 'yearly':
      return `Annually on ${format(startDate, 'MMMM d')}`;
    default:
      return 'Does not repeat';
  }
};

const getOrdinalSuffix = (day: number): string => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};
