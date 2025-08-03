
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ReminderTestPanel = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testEventReminders = async () => {
    setLoading(true);
    try {
      console.log("🔔 Testing event reminder function...");
      
      // First check what events should get reminders using a direct query
      const { data: checkData, error: checkError } = await supabase
        .from('events')
        .select('*')
        .not('reminder_at', 'is', null)
        .is('reminder_sent_at', null)
        .lte('reminder_at', new Date().toISOString())
        .is('deleted_at', null);
      
      if (checkError) {
        console.error("Error checking reminders:", checkError);
        toast.error("Error checking reminders");
        return;
      }
      
      console.log("Events due for reminders:", checkData);
      
      // Now trigger the reminder function
      const { data: triggerData, error: triggerError } = await supabase.functions.invoke('send-event-reminder-email', {
        body: { manual_trigger: true }
      });

      if (triggerError) {
        console.error("Error triggering reminders:", triggerError);
        toast.error(`Error triggering reminders: ${triggerError.message}`);
        return;
      }

      console.log("Reminder function result:", triggerData);
      setResult({
        checkData,
        triggerData
      });
      
      toast.success("Reminder test completed - check console for details");
      
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("Unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const createTestEvent = async () => {
    setLoading(true);
    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        toast.error("Not authenticated");
        return;
      }

      // Create event with reminder in 1 minute
      const now = new Date();
      const startTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      const endTime = new Date(now.getTime() + 6 * 60 * 1000); // 6 minutes from now  
      const reminderTime = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now

      const eventData = {
        title: "Test Reminder Event",
        user_surname: "Test Reminder Event",
        user_number: "+1234567890",
        social_network_link: "test@example.com",
        event_notes: "This is a test event to verify reminder functionality",
        start_date: startTime.toISOString(),
        end_date: endTime.toISOString(),
        payment_status: "not_paid",
        payment_amount: null,
        language: "en",
        is_recurring: false,
        repeat_pattern: null,
        repeat_until: null,
        reminder_at: reminderTime.toISOString(),
        email_reminder_enabled: true
      };

      const { data: savedEventId, error: saveError } = await supabase.rpc('save_event_with_persons', {
        p_event_data: eventData,
        p_additional_persons: [],
        p_user_id: currentUser.data.user.id,
        p_event_id: null
      });

      if (saveError) {
        console.error("Error creating test event:", saveError);
        toast.error("Failed to create test event");
        return;
      }

      console.log("Created test event:", savedEventId);
      toast.success(`Test event created with ID: ${savedEventId}. Reminder set for ${reminderTime.toLocaleTimeString()}`);
      
    } catch (error) {
      console.error("Error creating test event:", error);
      toast.error("Error creating test event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Event Reminder Test Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={createTestEvent} 
            disabled={loading}
            variant="outline"
          >
            Create Test Event (2min reminder)
          </Button>
          <Button 
            onClick={testEventReminders} 
            disabled={loading}
          >
            {loading ? "Testing..." : "Test Reminder System"}
          </Button>
        </div>
        
        {result && (
          <div className="mt-4 p-4 bg-gray-100 rounded-md">
            <h4 className="font-semibold mb-2">Test Results:</h4>
            <pre className="text-sm overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
