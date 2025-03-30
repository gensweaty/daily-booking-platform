
import { CalendarContainer } from "./CalendarContainer";
import { CalendarViewType } from "@/lib/types/calendar";

interface CalendarProps {
  defaultView?: CalendarViewType;
  publicMode?: boolean;
  externalEvents?: any[];
  businessId?: string;
  fromDashboard?: boolean;
}

export const Calendar = (props: CalendarProps) => {
  return <CalendarContainer {...props} />;
};
