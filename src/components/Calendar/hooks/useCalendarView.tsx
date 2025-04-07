
import { useState } from "react";
import { CalendarViewType } from "@/lib/types/calendar";

export const useCalendarView = () => {
  const [selectedView, setSelectedView] = useState<CalendarViewType>("month");

  return {
    selectedView,
    setSelectedView,
  };
};
