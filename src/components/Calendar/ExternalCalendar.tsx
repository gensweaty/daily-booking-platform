
import { useState } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarViewType } from "@/lib/types/calendar";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");

  if (!businessId) {
    console.error("No businessId provided to ExternalCalendar");
    return null;
  }
  
  console.log("Rendering ExternalCalendar with businessId:", businessId);
  
  return (
    <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
      <CardContent className="p-0">
        <div className="px-6 pt-6">
          <Calendar 
            defaultView={view} 
            currentView={view}
            onViewChange={setView}
            isExternalCalendar={true} 
            businessId={businessId} 
            showAllEvents={true}
            allowBookingRequests={true}
          />
        </div>
      </CardContent>
    </Card>
  );
};
