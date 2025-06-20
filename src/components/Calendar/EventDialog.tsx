
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
}

// Standalone file upload function
async function uploadFileToEvent(file: File, eventId: string, userId: string) {
  console.log("📤 Starting file upload for event:", eventId);
  
  const fileExt = file.name.split('.').pop();
  const filePath = `${eventId}/${crypto.randomUUID()}.${fileExt}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('event_attachments')
    .upload(filePath, file);

  if (uploadError) {
    console.error("❌ Storage upload failed:", uploadError);
    throw uploadError;
  }

  // Create database record
  const fileData = {
    filename: file.name,
    file_path: filePath,
    content_type: file.type,
    size: file.size,
    user_id: userId,
    event_id: eventId,
  };

  const { data, error: insertError } = await supabase
    .from('event_files')
    .insert(fileData)
    .select()
    .single();

  if (insertError) {
    console.error("❌ Database insert failed:", insertError);
    throw insertError;
  }

  console.log("✅ File upload completed:", data);
  return data;
}

// Function to fetch fresh files for an event
async function fetchEventFiles(eventId: string) {
  console.log("🔄 Fetching fresh files for event:", eventId);
  
  const { data, error } = await supabase
    .from('event_files')
    .select('*')
    .eq('event_id', eventId);
    
  if (error) {
    console.error("❌ Error fetching files:", error);
    return [];
  }
  
  console.log("📁 Fetched files:", data?.length || 0);
  return data || [];
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  onSubmit,
  onDelete,
  event,
  isBookingRequest = false,
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
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [isBookingEvent, setIsBookingEvent] = useState(false);
  const isGeorgian = language === 'ka';
  const { loadGroupMembers, saveGroupMembers } = useGroupMembers();

  // Helper functions to clear field sets
  const clearIndividualFields = () => {
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setPaymentStatus("not_paid");
    setPaymentAmount("");
  };

  const clearGroupFields = () => {
    setGroupName("");
    setGroupMembers([]);
  };

  // Enhanced group event detection with multiple fallback methods
  const detectEventType = (event: CalendarEventType): boolean => {
    console.log("🔍 Detecting event type for:", { 
      id: event.id, 
      is_group_event: event.is_group_event,
      group_name: event.group_name,
      group_member_count: event.group_member_count
    });

    // Method 1: Check is_group_event field (primary)
    if (event.is_group_event === true) {
      console.log("✅ Group event detected via is_group_event field");
      return true;
    }

    // Method 2: Check if group_name exists and differs from title/user_surname
    if (event.group_name && event.group_name.trim()) {
      console.log("✅ Group event detected via group_name field");
      return true;
    }

    // Method 3: Check group_member_count > 1
    if (event.group_member_count && event.group_member_count > 1) {
      console.log("✅ Group event detected via group_member_count > 1");
      return true;
    }

    // Method 4: Check if event has parent_group_id (indicating it's part of a group)
    if (event.parent_group_id) {
      console.log("✅ Group event detected via parent_group_id");
      return true;
    }

    console.log("❌ Individual event detected");
    return false;
  };

  // Atomic data loading function
  const loadEventData = async (eventToLoad: CalendarEventType): Promise<{ isGroup: boolean; members: GroupMember[] }> => {
    console.log("📥 Loading event data atomically for:", eventToLoad.id);
    
    try {
      // Detect event type
      const isGroup = detectEventType(eventToLoad);
      
      if (!isGroup) {
        return { isGroup: false, members: [] };
      }

      // For group events, load members
      console.log("👥 Loading group members for group event:", eventToLoad.id);
      
      const groupMembers = await loadGroupMembers(eventToLoad.id);

      if (groupMembers.length === 0 && (eventToLoad.user_surname || eventToLoad.title)) {
        console.log("📝 Creating default member from event data");
        const defaultMember: GroupMember = {
          user_surname: eventToLoad.user_surname || eventToLoad.title || "",
          user_number: eventToLoad.user_number || "",
          social_network_link: eventToLoad.social_network_link || "",
          event_notes: eventToLoad.event_notes || "",
          payment_status: eventToLoad.payment_status || "not_paid",
          payment_amount: eventToLoad.payment_amount?.toString() || "",
        };
        groupMembers.push(defaultMember);
      }

      console.log("✅ Loaded group members:", { count: groupMembers.length });
      return { isGroup, members: groupMembers };
      
    } catch (error) {
      console.error("💥 Exception loading event data:", error);
      return { isGroup: false, members: [] };
    }
  };

  // Simplified initialization with proper loading states
  useEffect(() => {
    if (!open) {
      // Reset all fields when dialog closes
      console.log("❌ Dialog closed, resetting all fields");
      setTitle("");
      clearIndividualFields();
      clearGroupFields();
      setIsGroupEvent(false);
      setDisplayedFiles([]);
      setSelectedFile(null);
      setFileError("");
      setIsLoading(false);
      setIsSaving(false);
      return;
    }

    const initializeDialog = async () => {
      console.log("🔄 EventDialog initializing", { eventId: event?.id });
      setIsLoading(true);

      try {
        if (event) {
          console.log("📝 Loading existing event", { id: event.id });
          
          // Load event data atomically
          const { isGroup, members } = await loadEventData(event);
          
          // Set common fields
          const start = new Date(event.start_date);
          const end = new Date(event.end_date);
          
          const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
          const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
          setStartDate(formattedStart);
          setEndDate(formattedEnd);
          setOriginalStartDate(formattedStart);
          setOriginalEndDate(formattedEnd);
          setIsBookingEvent(event.type === 'booking_request');
          
          // Set event type and corresponding fields
          setIsGroupEvent(isGroup);
          
          if (isGroup) {
            // GROUP EVENT: Load group data and members
            const eventGroupName = event.group_name || event.title || "";
            setTitle(eventGroupName);
            setGroupName(eventGroupName);
            setGroupMembers(members);
            
            // Clear individual fields
            clearIndividualFields();
            
            console.log("🏢 Loaded GROUP event", { name: eventGroupName, membersCount: members.length });
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
            clearGroupFields();
            
            console.log("👤 Loaded INDIVIDUAL event", { userSurname: fullName });
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
          clearIndividualFields();
          clearGroupFields();
          setIsGroupEvent(false);
          setIsBookingEvent(false);
        }
      } catch (error) {
        console.error("❌ Error initializing dialog:", error);
        toast({
          title: "Error",
          description: "Failed to load event data",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeDialog();
  }, [open, event, selectedDate, toast, loadGroupMembers]);

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

  // FIXED: Atomic save operation for group events with explicit groupMembers parameter
  const saveGroupEventAtomically = async (
    eventData: Partial<CalendarEventType>,
    groupMembers: GroupMember[]
  ) => {
    if (!user) {
      throw new Error("Missing user");
    }

    console.log("🔒 Starting atomic group event save");

    try {
      // Step 1: Save the main event
      const savedEvent = await onSubmit(eventData);
      
      if (!savedEvent?.id) {
        throw new Error("Failed to save main event");
      }

      // Step 2: Save group members using explicit parameter
      const success = await saveGroupMembers(
        savedEvent.id, 
        groupMembers, 
        user.id,
        savedEvent.start_date,
        savedEvent.end_date
      );
      
      if (!success) {
        throw new Error("Failed to save group members");
      }
      
      console.log("✅ Atomic group event save completed successfully");
      return savedEvent;
      
    } catch (error) {
      console.error("💥 Atomic group event save failed:", error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading || isSaving) {
      console.log("⏸️ Still loading or saving, preventing submit");
      return;
    }
    
    // Use appropriate title based on event type
    const finalTitle = isGroupEvent ? groupName : userSurname;
    
    if (!finalTitle.trim()) {
      toast({
        title: "Error",
        description: isGroupEvent ? "Group name is required" : "Full name is required",
      });
      return;
    }
    
    setIsSaving(true);
    console.log("💾 Starting save process");
    
    try {
      const startDateTime = new Date(startDate);
      const endDateTime = new Date(endDate);
      
      const timesChanged = startDate !== originalStartDate || endDate !== originalEndDate;
      console.log("⏰ Time changed during edit?", timesChanged);

      const wasBookingRequest = event?.type === 'booking_request';
      
      try {
        // Prepare event data with STRICT field separation
        const eventData: Partial<CalendarEventType> = {
          title: finalTitle,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          language: event?.language || language,
          is_group_event: isGroupEvent,
          group_member_count: isGroupEvent ? groupMembers.length : 1,
        };

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

        let createdEvent: CalendarEventType;

        if (isGroupEvent) {
          // FOR GROUP EVENTS: Set group fields, NULL individual fields
          eventData.group_name = groupName;
          eventData.user_surname = null;
          eventData.user_number = null;
          eventData.social_network_link = null;
          eventData.event_notes = null;
          eventData.payment_status = null;
          eventData.payment_amount = null;
          
          console.log("💾 Saving GROUP event with members", { membersCount: groupMembers.length });
          
          // FIXED: Use atomic save for group events with explicit groupMembers parameter
          createdEvent = await saveGroupEventAtomically(eventData, groupMembers);
          
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
          
          // Regular save for individual events
          createdEvent = await onSubmit(eventData);
        }

        // FIXED: Assign eventData.id = createdEvent.id for file upload
        eventData.id = createdEvent.id;

        // Handle file upload with proper timing
        if (selectedFile && user) {
          const eventId = createdEvent.id;
          if (eventId) {
            try {
              console.log('📤 Uploading file for event:', eventId);
              
              const uploadedFile = await uploadFileToEvent(selectedFile, eventId, user.id);
              
              console.log('✅ File uploaded successfully:', uploadedFile);
              
              // Wait for Supabase propagation
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Fetch fresh files and update state
              const freshFiles = await fetchEventFiles(eventId);
              setDisplayedFiles(freshFiles);
              
              console.log('📁 Fresh files loaded after upload:', freshFiles.length);
            } catch (fileError) {
              console.error("❌ Error handling file upload:", fileError);
              toast({
                title: "File Upload Error",
                description: "The event was saved but file upload failed. Please try uploading the file again.",
              });
            }
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

        // Debug final state before closing
        console.log("🧾 Final state of displayed files:", displayedFiles);

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
    } finally {
      setIsSaving(false);
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

  // Show loading state while initializing
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
            Loading Event...
          </DialogTitle>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading event data...</span>
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
              <Button type="submit" className="flex-1" disabled={isLoading || isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
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
                  disabled={isSaving}
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
      </Dialog>
    </>
  );
};

export default EventDialog;
