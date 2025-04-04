
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultEndDate?: Date | null;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: () => void;
  event?: CalendarEventType;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  event,
}: EventDialogProps) => {
  const [title, setTitle] = useState(event?.title || "");
  const [userSurname, setUserSurname] = useState(event?.user_surname || "");
  const [userNumber, setUserNumber] = useState(event?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(event?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState(event?.event_notes || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(event?.payment_status || "");
  const [paymentAmount, setPaymentAmount] = useState(event?.payment_amount?.toString() || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  useEffect(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    } else if (selectedDate) {
      // Create a new date object to prevent mutation
      const start = new Date(selectedDate.getTime());
      const end = new Date(selectedDate.getTime());
      
      // Always set to 9 AM for the clicked date
      start.setHours(9, 0, 0, 0);
      end.setHours(10, 0, 0, 0);
      
      console.log('Setting dialog dates:', {
        selectedDate,
        start,
        end
      });
      
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [selectedDate, event, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      console.error("No authenticated user found when submitting event");
      toast({
        title: "Error",
        description: "You must be logged in to create or edit events",
        variant: "destructive",
      });
      return;
    }
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    // CRITICAL SECURITY FIX: Always set the user_id to the current user's ID
    const eventData = {
      title,
      user_surname: userSurname,
      user_number: userNumber,
      social_network_link: socialNetworkLink,
      event_notes: eventNotes,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      payment_status: paymentStatus || null,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      user_id: user.id, // CRITICAL: Always set the user_id
    };

    console.log("Submitting event with explicit user_id:", user.id);

    try {
      const createdEvent = await onSubmit(eventData);
      console.log('Created/Updated event:', createdEvent);
      
      // Verify that the created/updated event has the correct user_id
      if (createdEvent.user_id !== user.id) {
        console.error(`CRITICAL SECURITY ERROR: Event was saved with wrong user_id: ${createdEvent.user_id} instead of ${user.id}`);
        toast({
          title: "Security Warning",
          description: "There was a security concern with your event. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Customer record operations
      const { data: existingCustomer, error: customerQueryError } = await supabase
        .from('customers')
        .select('id')
        .eq('title', title)
        .eq('user_id', user.id) // CRITICAL SECURITY FIX: Filter by user_id 
        .maybeSingle();

      if (customerQueryError && customerQueryError.code !== 'PGRST116') {
        console.error('Error checking for existing customer:', customerQueryError);
        throw customerQueryError;
      }

      let customerId;
      
      if (!existingCustomer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            title,
            user_surname: userSurname,
            user_number: userNumber,
            social_network_link: socialNetworkLink,
            event_notes: eventNotes,
            payment_status: paymentStatus || null,
            payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
            start_date: startDateTime.toISOString(),
            end_date: endDateTime.toISOString(),
            user_id: user.id, // CRITICAL: Always set the user_id
            type: 'customer'
          })
          .select()
          .single();

        if (customerError) {
          console.error('Error creating new customer:', customerError);
          throw customerError;
        }
        customerId = newCustomer.id;
        console.log('Created new customer:', newCustomer);
      } else {
        customerId = existingCustomer.id;
        
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            user_surname: userSurname,
            user_number: userNumber,
            social_network_link: socialNetworkLink,
            event_notes: eventNotes,
            payment_status: paymentStatus || null,
            payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
            start_date: startDateTime.toISOString(),
            end_date: endDateTime.toISOString(),
          })
          .eq('id', customerId)
          .eq('user_id', user.id); // CRITICAL SECURITY FIX: Only update if user_id matches

        if (updateError) {
          console.error('Error updating customer:', updateError);
          throw updateError;
        }
        console.log('Updated existing customer:', customerId);
      }

      if (selectedFile && createdEvent?.id && user) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        
        console.log('Uploading file:', filePath);
        
        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw uploadError;
        }

        const fileData = {
          filename: selectedFile.name,
          file_path: filePath,
          content_type: selectedFile.type,
          size: selectedFile.size,
          user_id: user.id
        };

        const filePromises = [];

        filePromises.push(
          supabase
            .from('event_files')
            .insert({
              ...fileData,
              event_id: createdEvent.id
            })
        );

        filePromises.push(
          supabase
            .from('customer_files_new')
            .insert({
              ...fileData,
              customer_id: customerId
            })
        );

        const results = await Promise.all(filePromises);
        const errors = results.filter(r => r.error);
        
        if (errors.length > 0) {
          console.error('Errors creating file records:', errors);
          throw errors[0].error;
        }

        console.log('File records created successfully');

        toast({
          title: "Success",
          description: "File uploaded successfully",
        });
      }

      onOpenChange(false);
      
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
    } catch (error: any) {
      console.error('Error handling event submission:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{event ? t("events.editEvent") : t("events.addNewEvent")}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <EventDialogFields
            title={title}
            setTitle={setTitle}
            userSurname={userSurname}
            setUserSurname={setUserSurname}
            userNumber={userNumber}
            setUserNumber={setUserNumber}
            socialNetworkLink={socialNetworkLink}
            setSocialNetworkLink={setSocialNetworkLink}
            eventNotes={eventNotes}
            setEventNotes={setEventNotes}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentAmount={paymentAmount}
            setPaymentAmount={setPaymentAmount}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            fileError={fileError}
            setFileError={setFileError}
            eventId={event?.id}
            onFileDeleted={handleFileDeleted}
          />
          
          <div className="flex justify-between gap-4">
            <Button type="submit" className="flex-1">
              {event ? t("events.updateEvent") : t("events.createEvent")}
            </Button>
            {event && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
