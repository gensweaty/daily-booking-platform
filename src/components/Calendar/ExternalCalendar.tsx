
import { useState, useEffect } from "react";
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarViewType } from "@/lib/types/calendar";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  const [view, setView] = useState<CalendarViewType>("month");
  const [businessUserId, setBusinessUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // First, get the user_id associated with this business
  useEffect(() => {
    const fetchBusinessUserData = async () => {
      if (!businessId) {
        console.error("No businessId provided to ExternalCalendar");
        return;
      }

      console.log("ExternalCalendar: Fetching user_id for business:", businessId);
      
      try {
        // Direct query to get the user_id for the specific business
        const { data, error } = await supabase
          .from("business_profiles")
          .select("user_id")
          .eq("id", businessId)
          .single();
          
        if (error) {
          console.error("Error fetching business user_id:", error);
          toast({
            title: "Error loading calendar",
            description: "Could not fetch business data.",
            variant: "destructive"
          });
          return;
        }
        
        if (data && data.user_id) {
          console.log("ExternalCalendar: Found user_id for business:", data.user_id);
          setBusinessUserId(data.user_id);
        } else {
          console.error("No user_id found for business:", businessId);
          toast({
            title: "Error loading calendar",
            description: "Could not find business owner data.",
            variant: "destructive"
          });
        }
      } catch (err) {
        console.error("Exception fetching business user_id:", err);
        toast({
          title: "Error",
          description: "An unexpected error occurred.",
          variant: "destructive"
        });
      }
    };

    if (businessId) {
      fetchBusinessUserData();
    }
  }, [businessId, toast]);
  
  if (!businessId) {
    console.error("No businessId provided to ExternalCalendar");
    return null;
  }
  
  return (
    <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
      <CardContent className="p-0">
        <div className="px-6 pt-6">
          {businessUserId && (
            <>
              {console.log("Rendering Calendar with businessId:", businessId, "businessUserId:", businessUserId)}
              <Calendar 
                defaultView={view} 
                currentView={view}
                onViewChange={setView}
                isExternalCalendar={true} 
                businessId={businessId}
                businessUserId={businessUserId} 
                showAllEvents={true}
                allowBookingRequests={true}
              />
            </>
          )}
          {!businessUserId && (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading calendar...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
