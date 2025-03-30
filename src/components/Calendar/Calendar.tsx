
import { CalendarContainer } from "./CalendarContainer";
import { CalendarViewType } from "@/lib/types/calendar";

interface CalendarProps {
  defaultView?: CalendarViewType;
  publicMode?: boolean;
  externalEvents?: any[];
  businessId?: string;
  fromDashboard?: boolean;
}

export const Calendar = ({
  defaultView = "month",
  publicMode = false,
  externalEvents,
  businessId,
  fromDashboard = false
}: CalendarProps) => {
  console.log(`[Calendar] Rendering with ${externalEvents?.length || 0} external events, publicMode: ${publicMode}, businessId: ${businessId}`);
  
  return (
    <CalendarContainer 
      defaultView={defaultView}
      publicMode={publicMode}
      externalEvents={externalEvents}
      businessId={businessId} 
      fromDashboard={fromDashboard}
    />
  );
};
