
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { BusinessSettingsForm } from "./BusinessSettingsForm";
import { BookingApprovalList } from "./BookingApprovalList";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { Badge } from "@/components/ui/badge";

export const BusinessPage = () => {
  const [activeTab, setActiveTab] = useState("settings");
  const { user } = useAuth();
  const { pendingRequests, isLoading: isLoadingRequests } = useBookingRequests();
  const pendingCount = pendingRequests?.length || 0;

  // Show approval tab by default when there are pending requests
  useEffect(() => {
    if (pendingCount > 0 && activeTab === "settings") {
      setActiveTab("approvals");
    }
  }, [pendingCount]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">My Business</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings" className="relative">
            Settings
          </TabsTrigger>
          <TabsTrigger value="approvals" className="relative">
            Booking Approvals
            {pendingCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 flex items-center justify-center h-5 min-w-5 p-0 text-xs"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <BusinessSettingsForm />
        </TabsContent>

        <TabsContent value="approvals">
          <BookingApprovalList />
        </TabsContent>
      </Tabs>
    </div>
  );
};
