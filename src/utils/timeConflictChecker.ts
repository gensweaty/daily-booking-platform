
import { CalendarEventType } from "@/lib/types/calendar";
import { parseISO, isAfter, isBefore } from "date-fns";

export interface ConflictingEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  type: string;
}

export interface TimeConflictResult {
  hasConflicts: boolean;
  conflicts: ConflictingEvent[];
}

/**
 * Check if two time ranges overlap
 */
export const doTimeRangesOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  try {
    const startDate1 = parseISO(start1);
    const endDate1 = parseISO(end1);
    const startDate2 = parseISO(start2);
    const endDate2 = parseISO(end2);

    // Two ranges overlap if:
    // start1 < end2 AND start2 < end1
    return isBefore(startDate1, endDate2) && isBefore(startDate2, endDate1);
  } catch (error) {
    console.error('Error parsing dates for overlap check:', error);
    return false;
  }
};

/**
 * Check for time conflicts with existing events
 */
export const checkTimeConflicts = (
  newEventStart: string,
  newEventEnd: string,
  existingEvents: CalendarEventType[],
  excludeEventId?: string
): TimeConflictResult => {
  const conflicts: ConflictingEvent[] = [];

  for (const event of existingEvents) {
    // Skip the event being edited
    if (excludeEventId && event.id === excludeEventId) {
      continue;
    }

    // Skip deleted events
    if (event.deleted_at) {
      continue;
    }

    // Check for overlap
    if (doTimeRangesOverlap(newEventStart, newEventEnd, event.start_date, event.end_date)) {
      conflicts.push({
        id: event.id,
        title: event.title || event.user_surname || 'Untitled Event',
        start_date: event.start_date,
        end_date: event.end_date,
        type: event.type || 'event'
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
};

/**
 * Check for conflicts with booking requests
 */
export const checkBookingConflicts = (
  newEventStart: string,
  newEventEnd: string,
  approvedBookings: any[],
  excludeBookingId?: string
): TimeConflictResult => {
  const conflicts: ConflictingEvent[] = [];

  for (const booking of approvedBookings) {
    // Skip the booking being processed
    if (excludeBookingId && booking.id === excludeBookingId) {
      continue;
    }

    // Skip deleted bookings
    if (booking.deleted_at) {
      continue;
    }

    // Only check approved bookings
    if (booking.status !== 'approved') {
      continue;
    }

    // Check for overlap
    if (doTimeRangesOverlap(newEventStart, newEventEnd, booking.start_date, booking.end_date)) {
      conflicts.push({
        id: booking.id,
        title: booking.title || booking.requester_name || 'Untitled Booking',
        start_date: booking.start_date,
        end_date: booking.end_date,
        type: 'booking_request'
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
};
