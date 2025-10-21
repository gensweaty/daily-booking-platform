
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCustomReminder } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ensureNotificationPermission, getPermissionInstructions, getDeviceSpecificMessage } from "@/utils/notificationUtils";
import { detectDevice } from "@/utils/deviceDetector";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";

export const AddReminderForm = ({ onClose }: { onClose: () => void }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recipientType, setRecipientType] = useState<"self" | "customer" | "event">("self");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch customers and events with valid emails
  useEffect(() => {
    if (!user?.id) return;

    const fetchRecipientsWithEmails = async () => {
      // Fetch customers with email in social_network_link
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, title, user_surname, social_network_link')
        .eq('user_id', user.id)
        .not('social_network_link', 'is', null)
        .neq('social_network_link', '')
        .is('deleted_at', null);

      // Fetch events with email
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, user_surname, social_network_link')
        .eq('user_id', user.id)
        .not('social_network_link', 'is', null)
        .neq('social_network_link', '')
        .is('deleted_at', null);

      setCustomers(customersData || []);
      setEvents(eventsData || []);
    };

    fetchRecipientsWithEmails();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You need to be logged in to create reminders",
        variant: "destructive",
      });
      return;
    }

    // Validate recipient selection
    if (recipientType !== "self" && !selectedRecipientId) {
      toast({
        title: "Error",
        description: "Please select a recipient",
        variant: "destructive",
      });
      return;
    }

    // Request notification permission when creating a reminder with due date
    if (dueDate) {
      const device = detectDevice();
      console.log(`🔔 Requesting notification permission for reminder creation on ${device.os}`);
      
      const permissionGranted = await ensureNotificationPermission();
      
      if (permissionGranted) {
        toast({
          title: "🔔 Notifications Enabled",
          description: `Perfect! You'll receive reminder notifications on your ${device.os} device`,
          duration: 4000,
        });
      } else if (Notification.permission === "denied") {
        const instructions = getPermissionInstructions();
        toast({
          title: "⚠️ Notifications Blocked",
          description: instructions,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        const deviceMessage = getDeviceSpecificMessage();
        toast({
          title: "🔔 Enable Notifications",
          description: deviceMessage,
          duration: 5000,
        });
      }
    }
    
    try {
      // Determine recipient email based on selection
      let recipientEmail: string | undefined = undefined;
      let recipientCustomerId: string | undefined = undefined;
      let recipientEventId: string | undefined = undefined;

      if (recipientType === "customer") {
        const customer = customers.find(c => c.id === selectedRecipientId);
        recipientEmail = customer?.social_network_link;
        recipientCustomerId = selectedRecipientId;
      } else if (recipientType === "event") {
        const event = events.find(e => e.id === selectedRecipientId);
        recipientEmail = event?.social_network_link;
        recipientEventId = selectedRecipientId;
      }

      await createCustomReminder({ 
        title, 
        message, 
        remind_at: dueDate,
        user_id: user.id,
        recipient_email: recipientEmail,
        recipient_customer_id: recipientCustomerId,
        recipient_event_id: recipientEventId,
        created_by_type: 'admin',
      });
      
      await queryClient.invalidateQueries({ queryKey: ['custom-reminders'] });
      toast({
        title: "Success",
        description: recipientEmail 
          ? `Reminder created - will be sent to ${recipientEmail}`
          : "Reminder created successfully",
      });
      onClose();
    } catch (error) {
      console.error('Reminder creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create reminder. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DialogTitle>Add New Reminder</DialogTitle>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Reminder title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="message">Message (optional)</Label>
          <Textarea
            id="message"
            placeholder="Additional details"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="dueDate">Remind At</Label>
          <Input
            id="dueDate"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="recipientType">Send Reminder To</Label>
          <Select value={recipientType} onValueChange={(value: any) => {
            setRecipientType(value);
            setSelectedRecipientId("");
          }}>
            <SelectTrigger id="recipientType">
              <SelectValue placeholder="Select recipient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Myself</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="event">Event Person</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {recipientType === "customer" && (
          <div>
            <Label htmlFor="customer">Select Customer</Label>
            <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Choose a customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.user_surname || customer.title} ({customer.social_network_link})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {recipientType === "event" && (
          <div>
            <Label htmlFor="event">Select Event Person</Label>
            <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
              <SelectTrigger id="event">
                <SelectValue placeholder="Choose an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title} - {event.user_surname} ({event.social_network_link})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button type="submit">Add Reminder</Button>
      </form>
    </>
  );
};
