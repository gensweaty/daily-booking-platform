import { startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { CalendarViewType } from "@/lib/types/calendar";

export const getDaysForView = (selectedDate: Date, view: CalendarViewType) => {
  switch (view) {
    case "month":
      return eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      });
    case "week":
      return eachDayOfInterval({
        start: startOfWeek(selectedDate),
        end: endOfWeek(selectedDate),
      });
    case "day":
      return [selectedDate];
  }
};