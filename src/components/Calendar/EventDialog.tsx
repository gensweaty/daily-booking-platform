
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";
import { Trash2, AlertCircle } from "lucide-react";
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
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  event,
  isBookingRequest = false
}: EventDialogProps) => {
  // Always initialize with user_surname as the primary name field
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
  const { loadGroupMembers } = useGroupMembers();
  
  // Add a ref to track if dialog has been initialized to prevent unnecessary resets
  const dialogInitializedRef = useRef(false);

  // Enhanced group event loading with proper async handling
  useEffect(() => {
    const initializeEventData = async () => {
      console.log("EventDialog initializing with event:", event);
      
      // Only initialize if dialog is open
      if (!open) {
        dialogInitializedRef.current = false;
        return;
      }

      // Skip if already initialized and no event change
      if (dialogInitializedRef.current && !event) {
        return;
      }
      
      if (event) {
        const start = new Date(event.start_date);
        const end = new Date(event.end_date);
        
        // Improved group event detection - check multiple indicators
        const isGroupEventType = Boolean(
          event.is_group_event || 
          event.group_name || 
          (event.type === 'group_event')
        );
        
        console.log("Event group detection:", { 
          is_group_event: event.is_group_event, 
          group_name: event.group_name,
          event_type: event.type,
          final_is_group: isGroupEventType 
        });
        
        setIsGroupEvent(isGroupEventType);
        
        if (isGroupEventType) {
          // For group events, ONLY set group fields and clear individual fields
          const eventGroupName = event.group_name || event.title || "";
          setTitle(eventGroupName);
          setGroupName(eventGroupName);
          
          // Explicitly clear ALL individual fields for group events
          setUserSurname("");
          setUserNumber("");
          setSocialNetworkLink("");
          setEventNotes("");
          setPaymentStatus("not_paid");
          setPaymentAmount("");
          
          console.log("Group event loaded - cleared individual fields, set group name:", eventGroupName);
          
          // Load group members for existing group events
          if (event.id) {
            setIsLoadingMembers(true);
            try {
              const members = await loadGroupMembers(event.id);
              console.log("Loaded group members for editing:", members);
              setGroupMembers(members);
            } catch (error) {
              console.error("Error loading group members:", error);
              setGroupMembers([]);
            } finally {
              setIsLoadingMembers(false);
            }
          }
        } else {
          // For individual events, set individual fields and clear group fields
          const fullName = event.user_surname || event.title || "";
          setTitle(fullName);
          setUserSurname(fullName);
          setUserNumber(event.user_number || event.requester_phone || "");
          setSocialNetworkLink(event.social_network_link || event.requester_email || "");
          setEventNotes(event.event_notes || event.description || "");
          
          // Handle payment status normalization
          let normalizedStatus = event.payment_status || "not_paid";
          if (normalizedStatus.includes('partly')) normalizedStatus = 'partly_paid';
          else if (normalizedStatus.includes('fully')) normalizedStatus = 'fully_paid';
          else if (normalizedStatus.includes('not')) normalizedStatus = 'not_paid';
          
          setPaymentStatus(normalizedStatus);
          setPaymentAmount(event.payment_amount?.toString() || "");
          
          // Clear group fields for individual events
          setGroupName("");
          setGroupMembers([]);
          
          console.log("Individual event loaded - populated individual fields");
        }
        
        // Set date fields (common for both types)
        const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
        const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
        setStartDate(formattedStart);
        setEndDate(formattedEnd);
        setOriginalStartDate(formattedStart);
        setOriginalEndDate(formattedEnd);
        
        setIsBookingEvent(event.type === 'booking_request');
        
      } else if (selectedDate && !dialogInitializedRef.current) {
        // Only reset for new event creation if not already initialized
        const start = new Date(selectedDate.getTime());
        const end = new Date(selectedDate.getTime());
        end.setHours(end.getHours() + 1);
        
        const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
        const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
        
        setStartDate(formattedStart);
        setEndDate(formattedEnd);
        setOriginalStartDate(formattedStart);
        setOriginalEndDate(formattedEnd);
        setPaymentStatus("not_paid");
        
        // Reset all fields only for new events
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setPaymentAmount("");
        setIsGroupEvent(false);
        setGroupName("");
        setGroupMembers([]);
        
        console.log("New event initialized - all fields cleared");
      }
      
      // Mark as initialized
      dialogInitializedRef.current = true;
    };

    initializeEventData();
  }, [selectedDate, event, open]); // Removed loadGroupMembers from dependencies

  // Load files for this event with improved customer file handling
  useEffect(() => {
    const loadFiles = async () => {
      if (!event?.id) {
        setDisplayedFiles([]);
        return;
      }
      
      try {
        console.log("Loading files for event:", event.id);
        
        // Step 1: Load direct event files
        const { data: eventFiles, error: eventFilesError } = await supabase
          .from('event_files')
          .select('*')
          .eq('event_id', event.id);
            
        if (eventFilesError) {
          console.error("Error loading event files:", eventFilesError);
        }
        
        let allFiles = [];
        
        // Add event files if they exist
        if (eventFiles && eventFiles.length > 0) {
          console.log("Loaded files from event_files:", eventFiles.length);
          const filesWithSource = eventFiles.map(file => ({
            ...file,
            parentType: 'event'
          }));
          allFiles = [...filesWithSource];
        } else {
          console.log("No direct event files found for event:", event.id);
        }
        
        // Step 2: If this event has a customer_id, also load customer files
        if (event.customer_id) {
          console.log("Event has customer_id:", event.customer_id, "- loading customer files");
          
          const { data: customerFiles, error: customerFilesError } = await supabase
            .from('customer_files_new')
            .select('*')
            .eq('customer_id', event.customer_id);
            
          if (customerFilesError) {
            console.error("Error loading customer files:", customerFilesError);
          } else if (customerFiles && customerFiles.length > 0) {
            console.log("Loaded files from customer_files_new:", customerFiles.length);
            
            const customerFilesWithSource = customerFiles.map(file => ({
              ...file,
              parentType: 'customer',
              id: file.id
            }));
            
            allFiles = [...allFiles, ...customerFilesWithSource];
          }
        }
        
        console.log("Total files to display:", allFiles.length);
        setDisplayedFiles(allFiles);
        
      } catch (err) {
        console.error("Exception loading event files:", err);
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
    
    // For group events, use group name as title, otherwise use userSurname
    const finalTitle = isGroupEvent ? groupName : userSurname;
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    const timesChanged = startDate !== originalStartDate || endDate !== originalEndDate;
    console.log("Time changed during edit?", timesChanged, {
      originalStart: originalStartDate,
      currentStart: startDate,
      originalEnd: originalEndDate,
      currentEnd: endDate
    });

    const wasBookingRequest = event?.type === 'booking_request';
    const isApprovingBookingRequest = wasBookingRequest && !isBookingEvent;
    
    // Ensure payment status is properly normalized before submission
    let normalizedPaymentStatus = paymentStatus;
    if (normalizedPaymentStatus.includes('partly')) normalizedPaymentStatus = 'partly_paid';
    else if (normalizedPaymentStatus.includes('fully')) normalizedPaymentStatus = 'fully_paid';
    else if (normalizedPaymentStatus.includes('not')) normalizedPaymentStatus = 'not_paid';
    
    console.log("Submitting with payment status:", normalizedPaymentStatus);
    console.log("Is group event submission:", isGroupEvent);
    
    // Ensure we preserve the original event language if available
    const eventData: Partial<CalendarEventType> = {
      title: finalTitle,
      // For group events, clear individual fields in the main event record
      user_surname: isGroupEvent ? "" : userSurname,
      user_number: isGroupEvent ? "" : userNumber,
      social_network_link: isGroupEvent ? "" : socialNetworkLink,
      event_notes: isGroupEvent ? "" : eventNotes,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      payment_status: isGroupEvent ? "not_paid" : normalizedPaymentStatus,
      payment_amount: isGroupEvent ? null : (paymentAmount ? parseFloat(paymentAmount) : null),
      language: event?.language || language,
      // Group event fields
      is_group_event: isGroupEvent,
      group_name: isGroupEvent ? groupName : null,
      group_member_count: isGroupEvent ? groupMembers.length : 1,
      parent_group_id: isGroupEvent ? (event?.id || null) : null
    };

    if (event?.id) {
      eventData.id = event.id;
    }

    if (wasBookingRequest) {
      eventData.type = 'event';
      console.log("Converting booking request to event:", { wasBookingRequest, isApprovingBookingRequest });
    } else if (event?.type) {
      eventData.type = event.type;
    } else {
      eventData.type = isGroupEvent ? 'group_event' : 'event';
    }

    try {
      console.log("EventDialog - Submitting event data:", eventData);
      const createdEvent = await onSubmit(eventData);
      console.log('Created/Updated event:', createdEvent);
      
      // Handle group members if this is a group event
      if (isGroupEvent && groupMembers.length > 0 && createdEvent?.id && user) {
        try {
          // First, delete existing group members if updating
          if (event?.id) {
            const { error: deleteError } = await supabase
              .from('customers')
              .delete()
              .eq('parent_group_id', event.id)
              .eq('is_group_member', true);
              
            if (deleteError) {
              console.error('Error deleting existing group members:', deleteError);
            } else {
              console.log('Deleted existing group members for update');
            }
          }

          // Create individual customer records for each group member
          for (const member of groupMembers) {
            const customerData = {
              title: member.user_surname,
              user_surname: member.user_surname,
              user_number: member.user_number,
              social_network_link: member.social_network_link,
              event_notes: member.event_notes,
              payment_status: member.payment_status,
              payment_amount: member.payment_amount ? parseFloat(member.payment_amount) : null,
              user_id: user.id,
              type: 'group_member',
              start_date: startDateTime.toISOString(),
              end_date: endDateTime.toISOString(),
              parent_group_id: createdEvent.id,
              is_group_member: true
            };

            const { error: customerError } = await supabase
              .from('customers')
              .insert(customerData);

            if (customerError) {
              console.error('Error creating group member customer:', customerError);
            } else {
              console.log('Created customer for group member:', member.user_surname);
            }
          }
        } catch (groupError) {
          console.error("Error handling group members:", groupError);
        }
      }
      
      // Handle file upload to event_files for the current event
      if (selectedFile && createdEvent?.id && user) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${createdEvent.id}/${crypto.randomUUID()}.${fileExt}`;
          
          console.log('Uploading file:', filePath);
          
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            throw uploadError;
          }

          // Create record in event_files table
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
            console.error('Error creating file record:', fileRecordError);
            throw fileRecordError;
          }

          console.log('File record created successfully in event_files');
        } catch (fileError) {
          console.error("Error handling file upload:", fileError);
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
      } else {
        if (event?.id) {
          try {
            const { data: bookingRequest, error: findError } = await supabase
              .from('booking_requests')
              .select('*')
              .eq('id', event.id)
              .maybeSingle();
              
            if (!findError && bookingRequest) {
              const { error: updateError } = await supabase
                .from('booking_requests')
                .update({
                  title: finalTitle,
                  requester_name: isGroupEvent ? groupName : userSurname,
                  requester_phone: isGroupEvent ? "" : userNumber,
                  requester_email: isGroupEvent ? "" : socialNetworkLink,
                  description: isGroupEvent ? `Group booking: ${groupName}` : eventNotes,
                  start_date: startDateTime.toISOString(),
                  end_date: endDateTime.toISOString(),
                })
                .eq('id', event.id);
                
              if (updateError) {
                console.error('Error updating booking request:', updateError);
              } else {
                console.log('Updated booking request successfully');
              }
            }
          } catch (bookingError) {
            console.error("Error updating booking request:", bookingError);
          }
        }
      }

      onOpenChange(false);
      
      // Invalidate all queries to ensure data is refreshed
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
    } catch (error: any) {
      console.error('Error handling event submission:', error);
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
              // Group booking props
              isGroupEvent={isGroupEvent}
              setIsGroupEvent={setIsGroupEvent}
              groupName={groupName}
              setGroupName={setGroupName}
              groupMembers={groupMembers}
              setGroupMembers={setGroupMembers}
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
