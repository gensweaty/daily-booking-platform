
import { Calendar } from "@/components/Calendar/Calendar";
import { useCombinedEvents } from "@/hooks/useCombinedEvents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { EventRequestsTable } from "./EventRequestsTable";

interface BusinessCalendarProps {
  businessId: string;
}

export const BusinessCalendar = ({ businessId }: BusinessCalendarProps) => {
  const [view, setView] = useState<"calendar" | "requests">("calendar");
  const { events, isLoading, refetch } = useCombinedEvents(businessId);
  
  // Force refetch when component mounts to ensure data is fresh
  useEffect(() => {
    if (businessId) {
      console.log("[BusinessCalendar] Mounting with business ID:", businessId);
      refetch();
    }
  }, [businessId, refetch]);
  
  console.log(`[BusinessCalendar] Rendering with ${events?.length || 0} events`);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle>Business Calendar</CardTitle>
          <Tabs defaultValue="calendar" value={view} onValueChange={(v) => setView(v as "calendar" | "requests")}>
            <TabsList>
              <TabsTrigger value="calendar">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="requests">
                <Users className="w-4 h-4 mr-2" />
                Booking Requests
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <TabsContent value="calendar" className="mt-0">
          <Calendar 
            defaultView="week" 
            businessId={businessId} 
            externalEvents={events} 
          />
        </TabsContent>
        <TabsContent value="requests" className="mt-0">
          <EventRequestsTable businessId={businessId} />
        </TabsContent>
      </CardContent>
    </Card>
  );
};
