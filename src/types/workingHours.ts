// Working Hours Types for Business Profile

export interface DaySchedule {
  enabled: boolean;
  start: string; // HH:mm format
  end: string;   // HH:mm format
}

export interface WorkingHoursConfig {
  enabled: boolean;
  timezone?: string;
  days: {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
  };
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  enabled: false,
  days: {
    monday: { enabled: true, start: "09:00", end: "18:00" },
    tuesday: { enabled: true, start: "09:00", end: "18:00" },
    wednesday: { enabled: true, start: "09:00", end: "18:00" },
    thursday: { enabled: true, start: "09:00", end: "18:00" },
    friday: { enabled: true, start: "09:00", end: "18:00" },
    saturday: { enabled: false, start: "09:00", end: "18:00" },
    sunday: { enabled: false, start: "09:00", end: "18:00" },
  },
};

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday', 
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Helper to get day of week from Date
export function getDayOfWeek(date: Date): DayOfWeek {
  const dayIndex = date.getDay();
  // Sunday is 0, we need to map it to our format
  const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayMap[dayIndex];
}

// Check if a specific hour is within working hours for a given day
export function isWithinWorkingHours(
  date: Date,
  hour: number,
  workingHours: WorkingHoursConfig | null | undefined
): boolean {
  // If working hours not configured or not enabled, all hours are available
  if (!workingHours || !workingHours.enabled) {
    return true;
  }

  const dayOfWeek = getDayOfWeek(date);
  const daySchedule = workingHours.days[dayOfWeek];

  // If day is not enabled, it's not within working hours
  if (!daySchedule.enabled) {
    return false;
  }

  // Parse start and end hours
  const [startHour] = daySchedule.start.split(':').map(Number);
  const [endHour] = daySchedule.end.split(':').map(Number);

  // Check if the hour is within the range
  return hour >= startHour && hour < endHour;
}

// Check if a specific date is a working day
export function isWorkingDay(
  date: Date,
  workingHours: WorkingHoursConfig | null | undefined
): boolean {
  // If working hours not configured or not enabled, all days are working days
  if (!workingHours || !workingHours.enabled) {
    return true;
  }

  const dayOfWeek = getDayOfWeek(date);
  return workingHours.days[dayOfWeek].enabled;
}

// Get working hours for a specific day
export function getWorkingHoursForDay(
  date: Date,
  workingHours: WorkingHoursConfig | null | undefined
): { start: string; end: string } | null {
  if (!workingHours || !workingHours.enabled) {
    return null;
  }

  const dayOfWeek = getDayOfWeek(date);
  const daySchedule = workingHours.days[dayOfWeek];

  if (!daySchedule.enabled) {
    return null;
  }

  return { start: daySchedule.start, end: daySchedule.end };
}
