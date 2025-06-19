import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Trash2, AlertCircle, Loader2 } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GroupMember } from "./GroupMembersField";
import { useGroupMembers } from "./hooks/useGroupMembers";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  defaultEndDate?: Date | null;
  onSubmit: (data: Partial<CalendarEventType>) => Promise<CalendarEventType>;
  onDelete?: () => void;
  event?: CalendarEventType;
  isBookingRequest?: boolean;
  isProcessingGroupMembers?: boolean;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  event,
  isBookingRequest = false,
  isProcessingGroupMembers = false,
}: EventDialogProps) => {
  // Individual event fields
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [originalStartDate, setOriginalStartDate] = useState("");
  const [originalEndDate, setOriginalEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  
  // Group booking state
  const [isGroupEvent, setIsGroupEvent] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [isBookingEvent, setIsBookingEvent] = useState(false);
  const isGeorgian = language === 'ka';
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { loadGroupMembers, saveGroupMembers } = useGroupMembers();

  // Simplified initialization - runs every time dialog opens or event changes
  useEffect(() => {
    if (!open) {
      // Reset all fields when dialog closes
      console.log("❌ Dialog closed, resetting all fields");
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setGroupName("");
      setGroupMembers([]);
      setIsGroupEvent(false);
      setDisplayedFiles([]);
      setSelectedFile(null);
      setFileError("");
      setIsLoadingMembers(false);
      return;
    }

    const initializeDialog = async () => {
      console.log("🔄 EventDialog initializing", { 
        eventId: event?.id, 
        isGroupEvent: event?.is_group_event,
        isProcessingGroupMembers
      });

      if (isProcessingGroupMembers) {
        console.log("⏳ Processing group members, showing loading state");
        setIsLoadingMembers(true);
        return;
      }

      if (event) {
        console.log("📝 Loading existing event", { id: event.id, is_group_event: event.is_group_event });
        
        const start = new Date(event.start_date);
        const end = new Date(event.end_date);
        
        // Set common fields
        const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
        const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
        setStartDate(formattedStart);
        setEndDate(formattedEnd);
        setOriginalStartDate(formattedStart);
        setOriginalEndDate(formattedEnd);
        setIsBookingEvent(event.type === 'booking_request');

        // Determine if this is a group event
        const isGroup = event.is_group_event === true;
        setIsGroupEvent(isGroup);

        if (isGroup) {
          // GROUP EVENT: Load group data and members
          const eventGroupName = event.group_name || event.title || "";
          setTitle(eventGroupName);
          setGroupName(eventGroupName);
          
          // Clear individual fields
          setUserSurname("");
          setUserNumber("");
          setSocialNetworkLink("");
          setEventNotes("");
          setPaymentStatus("not_paid");
          setPaymentAmount("");
          
          console.log("🏢 Loading GROUP event with members");
          
          // Load group members
          if (event.id) {
            setIsLoadingMembers(true);
            try {
              const members = await loadGroupMembers(event.id);
              console.log("👥 Loaded group members", { count: members.length });
              setGroupMembers(members);
            } catch (error) {
              console.error("❌ Error loading group members:", error);
              setGroupMembers([]);
            } finally {
              setIsLoadingMembers(false);
            }
          }
        } else {
          // INDIVIDUAL EVENT: Load individual data
          const fullName = event.user_surname || event.title || "";
          setTitle(fullName);
          setUserSurname(fullName);
          setUserNumber(event.user_number || "");
          setSocialNetworkLink(event.social_network_link || "");
          setEventNotes(event.event_notes || "");
          
          // Handle payment status
          let normalizedStatus = event.payment_status || "not_paid";
          if (normalizedStatus.includes('partly')) normalizedStatus = 'partly_paid';
          else if (normalizedStatus.includes('fully')) normalizedStatus = 'fully_paid';
          else if (normalizedStatus.includes('not')) normalizedStatus = 'not_paid';
          
          setPaymentStatus(normalizedStatus);
          setPaymentAmount(event.payment_amount?.toString() || "");
          
          // Clear group fields
          setGroupName("");
          setGroupMembers([]);
          
          console.log("👤 Loading INDIVIDUAL event", { userSurname: fullName });
        }
        
      } else if (selectedDate) {
        console.log("🆕 Creating new event");
        // New event creation
        const start = new Date(selectedDate.getTime());
        const end = new Date(selectedDate.getTime());
        end.setHours(end.getHours() + 1);
        
        const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
        const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
        
        setStartDate(formattedStart);
        setEndDate(formattedEnd);
        setOriginalStartDate(formattedStart);
        setOriginalEndDate(formattedEnd);
        
        // Reset all fields for new events
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setPaymentStatus("not_paid");
        setPaymentAmount("");
        setGroupName("");
        setGroupMembers([]);
        setIsGroupEvent(false);
        setIsBookingEvent(false);
      }
    };

    initializeDialog();
  }, [open, event, selectedDate, isProcessingGroupMembers, loadGroupMembers]);

  // Improved group event toggle with comprehensive field management
  const handleGroupEventToggle = (checked: boolean) => {
    console.log("🔄 Toggling event type", { from: isGroupEvent, to: checked });
    setIsGroupEvent(checked);
    
    if (checked) {
      // Switching TO group event: clear individual fields, preserve title as group name
      clearIndividualFields();
      if (title && !groupName) {
        setGroupName(title);
      }
      console.log("🏢 Switched to GROUP event");
    } else {
      // Switching TO individual event: clear group fields, preserve title as user surname
      clearGroupFields();
      if (title && !userSurname) {
        setUserSurname(title);
      }
      console.log("👤 Switched to INDIVIDUAL event");
    }
  };

  // Load files for this event
  useEffect(() => {
    const loadFiles = async () => {
      if (!event?.id) {
        setDisplayedFiles([]);
        return;
      }
      
      try {
        console.log("📁 Loading files for event:", event.id);
        
        const { data: eventFiles, error: eventFilesError } = await supabase
          .from('event_files')
          .select('*')
          .eq('event_id', event.id);
            
        if (eventFilesError) {
          console.error("❌ Error loading event files:", eventFilesError);
        }
        
        let allFiles = [];
        
        if (eventFiles && eventFiles.length > 0) {
          console.log("📎 Loaded event files:", eventFiles.length);
          const filesWithSource = eventFiles.map(file => ({
            ...file,
            parentType: 'event'
          }));
          allFiles = [...filesWithSource];
        }
        
        if (event.customer_id) {
          console.log("🔗 Loading customer files for customer_id:", event.customer_id);
          
          const { data: customerFiles, error: customerFilesError } = await supabase
            .from('customer_files_new')
            .select('*')
            .eq('customer_id', event.customer_id);
            
          if (customerFilesError) {
            console.error("❌ Error loading customer files:", customerFilesError);
          } else if (customerFiles && customerFiles.length > 0) {
            console.log("📎 Loaded customer files:", customerFiles.length);
            
            const customerFilesWithSource = customerFiles.map(file => ({
              ...file,
              parentType: 'customer',
              id: file.id
            }));
            
            allFiles = [...allFiles, ...customerFilesWithSource];
          }
        }
        
        console.log("📂 Total files loaded:", allFiles.length);
        setDisplayedFiles(allFiles);
        
      } catch (err) {
        console.error("💥 Exception loading event files:", err);
        setDisplayedFiles([]);
      }
    };
    
    if (open) {
      setSelectedFile(null);
      setFileError("");
      loadFiles();
    }
  }, [event, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use appropriate title based on event type
    const finalTitle = isGroupEvent ? groupName : userSurname;
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    const timesChanged = startDate !== originalStartDate || endDate !== originalEndDate;
    console.log("⏰ Time changed during edit?", timesChanged);

    const wasBookingRequest = event?.type === 'booking_request';
    
    // Prepare event data with STRICT field separation
    const eventData: Partial<CalendarEventType> = {
      title: finalTitle,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      language: event?.language || language,
      is_group_event: isGroupEvent,
      group_member_count: isGroupEvent ? groupMembers.length : 1,
    };

    if (isGroupEvent) {
      // FOR GROUP EVENTS: Set group fields, NULL individual fields
      eventData.group_name = groupName;
      eventData.user_surname = null;
      eventData.user_number = null;
      eventData.social_network_link = null;
      eventData.event_notes = null;
      eventData.payment_status = null;
      eventData.payment_amount = null;
      
      // Pass group members for processing
      eventData.groupMembers = groupMembers;
      
      console.log("💾 Saving GROUP event with members");
    } else {
      // FOR INDIVIDUAL EVENTS: Set individual fields, NULL group fields
      eventData.user_surname = userSurname;
      eventData.user_number = userNumber;
      eventData.social_network_link = socialNetworkLink;
      eventData.event_notes = eventNotes;
      eventData.payment_status = paymentStatus;
      eventData.payment_amount = paymentAmount ? parseFloat(paymentAmount) : null;
      eventData.group_name = null;
      
      console.log("💾 Saving INDIVIDUAL event");
    }

    if (event?.id) {
      eventData.id = event.id;
    }

    if (wasBookingRequest) {
      eventData.type = 'event';
    } else if (event?.type) {
      eventData.type = event.type;
    } else {
      eventData.type = isGroupEvent ? 'group_event' : 'event';
    }

    try {
      console.log("💾 Submitting event data:", eventData);
      const createdEvent = await onSubmit(eventData);
      console.log('✅ Event saved successfully:', createdEvent);
      
      // Handle group members for existing events (not new ones - those are handled in Calendar.tsx)
      if (isGroupEvent && groupMembers.length > 0 && event?.id && user) {
        console.log("🔄 Updating group members for existing event");
        const saveSuccess = await saveGroupMembers(
          event.id,
          groupMembers,
          user.id,
          startDateTime.toISOString(),
          endDateTime.toISOString()
        );
        
        if (!saveSuccess) {
          console.error("❌ Failed to save group members");
          toast({
            title: "Warning",
            description: "Event updated but failed to save some member details",
          });
        }
      }
      
      // Handle file upload
      if (selectedFile && createdEvent?.id && user) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${createdEvent.id}/${crypto.randomUUID()}.${fileExt}`;
          
          console.log('📤 Uploading file:', filePath);
          
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('❌ Error uploading file:', uploadError);
            throw uploadError;
          }

          const fileData = {
            filename: selectedFile.name,
            file_path: filePath,
            content_type: selectedFile.type,
            size: selectedFile.size,
            user_id: user.id,
            event_id: createdEvent.id
          };

          const { error: fileRecordError } = await supabase
            .from('event_files')
            .insert(fileData);
            
          if (fileRecordError) {
            console.error('❌ Error creating file record:', fileRecordError);
            throw fileRecordError;
          }

          console.log('✅ File uploaded and recorded successfully');
        } catch (fileError) {
          console.error("❌ Error handling file upload:", fileError);
        }
      }

      if (!isBookingEvent) {
        toast({
          translateKeys: {
            titleKey: "common.success",
            descriptionKey: isGroupEvent 
              ? (event?.id ? "events.groupEventUpdated" : "events.groupEventCreated")
              : (event?.id ? "events.eventUpdated" : "events.eventCreated")
          }
        });
      }

      // Query invalidation for all event types
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });

      // Close dialog after successful submission
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('❌ Error handling event submission:', error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
    }
  };

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleDeleteClick = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete();
      setIsDeleteConfirmOpen(false);
    }
  };

  if (isProcessingGroupMembers) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
            Processing Group Event...
          </DialogTitle>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Saving group members...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          "max-h-[90vh] overflow-y-auto",
          isGroupEvent ? "max-w-4xl w-[95vw]" : "max-w-lg w-[95vw]"
        )}>
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
            {event ? t("events.editEvent") : t("events.addNewEvent")}
            {isLoadingMembers && " (Loading members...)"}
          </DialogTitle>
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
              displayedFiles={displayedFiles}
              isBookingRequest={isBookingRequest}
              isGroupEvent={isGroupEvent}
              setIsGroupEvent={handleGroupEventToggle}
              groupName={groupName}
              setGroupName={setGroupName}
              groupMembers={groupMembers}
              setGroupMembers={setGroupMembers}
            />
            
            <div className="flex justify-between gap-4">
              <Button type="submit" className="flex-1" disabled={isLoadingMembers}>
                {isLoadingMembers ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  event ? t("events.updateEvent") : t("events.createEvent")
                )}
              </Button>
              {event && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t("common.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EventDialog;
