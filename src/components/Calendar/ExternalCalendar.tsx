
import { useState } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarViewType } from "@/lib/types/calendar";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");

  if (!businessId) {
    console.error("No businessId provided to ExternalCalendar");
    return null;
  }
  
  return (
    <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
      <CardContent className="p-0">
        <div className="flex justify-end gap-2 p-4 border-b">
          <Button 
            size="sm" 
            variant={view === "month" ? "default" : "outline"}
            onClick={() => setView("month")}
          >
            Month
          </Button>
          <Button 
            size="sm" 
            variant={view === "week" ? "default" : "outline"}
            onClick={() => setView("week")}
          >
            Week
          </Button>
          <Button 
            size="sm" 
            variant={view === "day" ? "default" : "outline"}
            onClick={() => setView("day")}
          >
            Day
          </Button>
        </div>
        <div className="px-6 pt-6">
          <Calendar 
            defaultView={view} 
            currentView={view}
            onViewChange={setView}
            isExternalCalendar={true} 
            businessId={businessId} 
            showAllEvents={true}
          />
        </div>
      </CardContent>
    </Card>
  );
};
