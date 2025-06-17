import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarEventType, GroupMember } from "@/lib/types/calendar";
import { Trash2, AlertCircle, Users, Plus } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { GroupParticipants } from "./GroupParticipants";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  // This ensures we're using the correct field for full name
  const [title, setTitle] = useState(event?.user_surname || event?.title || "");
  const [userSurname, setUserSurname] = useState(event?.user_surname || event?.title || "");
  const [userNumber, setUserNumber] = useState(event?.user_number || "");
  const [socialNetworkLink, setSocialNetworkLink] = useState(event?.social_network_link || "");
  const [eventNotes, setEventNotes] = useState(event?.event_notes || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [originalStartDate, setOriginalStartDate] = useState("");
  const [originalEndDate, setOriginalEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(event?.payment_status || "not_paid");
  const [paymentAmount, setPaymentAmount] = useState(event?.payment_amount?.toString() || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  
  // Group booking states
  const [isGroupEvent, setIsGroupEvent] = useState(event?.is_group_event || false);
  const [groupName, setGroupName] = useState(event?.group_name || "");
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(event?.group_members || []);
  const [showGroupParticipants, setShowGroupParticipants] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [isBookingEvent, setIsBookingEvent] = useState(false);
  const isGeorgian = language === 'ka';
  // Add state for delete confirmation dialog
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Synchronize fields when event data changes or when dialog opens
  useEffect(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      
      console.log("Loading event data:", event);
      
      // Set both title and userSurname to the user_surname value for consistency
      // If user_surname is missing, fall back to title
      const fullName = event.user_surname || event.title || "";
      setTitle(fullName);
      setUserSurname(fullName);
      
      setUserNumber(event.user_number || event.requester_phone || "");
      setSocialNetworkLink(event.social_network_link || event.requester_email || "");
      setEventNotes(event.event_notes || event.description || "");
      
      // Normalize payment status to handle different formats
      let normalizedStatus = event.payment_status || "not_paid";
      if (normalizedStatus.includes('partly')) normalizedStatus = 'partly_paid';
      else if (normalizedStatus.includes('fully')) normalizedStatus = 'fully_paid';
      else if (normalizedStatus.includes('not')) normalizedStatus = 'not_paid';
      
      console.log("Setting normalized payment status:", normalizedStatus);
      setPaymentStatus(normalizedStatus);
      setPaymentAmount(event.payment_amount?.toString() || "");
      
      const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
      const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
      
      setStartDate(formattedStart);
      setEndDate(formattedEnd);
      setOriginalStartDate(formattedStart);
      setOriginalEndDate(formattedEnd);
      
      setIsBookingEvent(event.type === 'booking_request');
      
      // Set group event data
      setIsGroupEvent(event.is_group_event || false);
      setGroupName(event.group_name || "");
      setGroupMembers(event.group_members || []);
      
      console.log("EventDialog - Loaded event with type:", event.type);
      console.log("EventDialog - Loaded payment status:", normalizedStatus);
    } else if (selectedDate) {
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
      
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentAmount("");
      
      // Reset group states
      setIsGroupEvent(false);
      setGroupName("");
      setGroupMembers([]);
    }
  }, [selectedDate, event, open]);

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
            
            // Mark these files as customer files for proper handling
            const customerFilesWithSource = customerFiles.map(file => ({
              ...file,
              parentType: 'customer',
              // Ensure ID is properly set for deduplication
              id: file.id
            }));
            
            // Add customer files to the collection
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
      // Reset file state when dialog opens
      setSelectedFile(null);
      setFileError("");
      loadFiles();
    }
  }, [event, open]);

  const createGroupEvents = async (parentEventId: string, members: GroupMember[]) => {
    if (!user) return [];
    
    const memberEvents = [];
    
    for (const member of members) {
      try {
        // Create individual event for each group member
        const memberEventData = {
          title: member.full_name,
          user_surname: member.full_name,
          user_number: member.phone || '',
          social_network_link: member.email,
          event_notes: member.notes || '',
          start_date: startDate,
          end_date: endDate,
          payment_status: member.payment_status || 'not_paid',
          payment_amount: null,
          type: 'event',
          user_id: user.id,
          is_group_event: false,
          parent_group_id: parentEventId,
          language: language
        };
        
        const { data: memberEvent, error } = await supabase
          .from('events')
          .insert(memberEventData)
          .select()
          .single();
          
        if (error) {
          console.error('Error creating member event:', error);
          continue;
        }
        
        // Create customer record
        const customerData = {
          title: member.full_name,
          user_surname: member.full_name,
          user_number: member.phone || '',
          social_network_link: member.email,
          event_notes: member.notes || '',
          start_date: startDate,
          end_date: endDate,
          payment_status: member.payment_status || 'not_paid',
          payment_amount: null,
          type: 'event',
          user_id: user.id
        };
        
        const { error: customerError } = await supabase
          .from('customers')
          .insert(customerData);
          
        if (customerError) {
          console.error('Error creating customer record:', customerError);
        }
        
        memberEvents.push(memberEvent);
        
      } catch (error) {
        console.error('Error processing group member:', member.full_name, error);
      }
    }
    
    return memberEvents;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for group events
    if (isGroupEvent) {
      if (!groupName.trim()) {
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "events.groupNameRequired"
          }
        });
        return;
      }
      
      if (groupMembers.length === 0) {
        toast({
          translateKeys: {
            titleKey: "common.error", 
            descriptionKey: "events.groupMembersRequired"
          }
        });
        return;
      }
    }
    
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
    
    // Use group name as title for group events, otherwise use userSurname
    const finalTitle = isGroupEvent ? groupName : userSurname;
    
    const eventData: Partial<CalendarEventType> = {
      title: finalTitle,
      user_surname: isGroupEvent ? groupName : userSurname, // Use userSurname for consistent naming
      user_number: userNumber,
      social_network_link: socialNetworkLink,
      event_notes: eventNotes,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      payment_status: normalizedPaymentStatus, // Use normalized payment status
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      language: event?.language || language, // Preserve original language or use current UI language
      is_group_event: isGroupEvent,
      group_name: isGroupEvent ? groupName : null,
      group_members: isGroupEvent ? groupMembers : null,
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
      eventData.type = 'event'; // Default type if not set
    }

    try {
      console.log("EventDialog - Submitting event data:", eventData);
      const createdEvent = await onSubmit(eventData);
      console.log('Created/Updated event:', createdEvent);
      
      // Create individual events for group members
      if (isGroupEvent && groupMembers.length > 0 && createdEvent?.id) {
        await createGroupEvents(createdEvent.id, groupMembers);
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
        // Replace hardcoded toast messages with translation keys
        toast({
          translateKeys: {
            titleKey: "common.success",
            descriptionKey: event?.id ? "events.eventUpdated" : "events.eventCreated"
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
                  title,
                  requester_name: userSurname,
                  requester_phone: userNumber,
                  requester_email: socialNetworkLink,
                  description: eventNotes,
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

  // Add function to handle delete button click
  const handleDeleteClick = () => {
    // Open confirmation dialog instead of deleting immediately
    setIsDeleteConfirmOpen(true);
  };

  // Add function to handle confirmed deletion
  const handleConfirmDelete = () => {
    if (onDelete) {
      onDelete();
      setIsDeleteConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
            {event ? t("events.editEvent") : t("events.addNewEvent")}
          </DialogTitle>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Group Event Toggle */}
            {!isBookingRequest && (
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <Switch
                  id="group-event"
                  checked={isGroupEvent}
                  onCheckedChange={setIsGroupEvent}
                />
                <Label htmlFor="group-event" className={cn("text-sm font-medium", isGeorgian ? "font-georgian" : "")}>
                  {t("events.groupEvent")}
                </Label>
              </div>
            )}
            
            {/* Group Name Field (only for group events) */}
            {isGroupEvent && (
              <div>
                <Label htmlFor="group-name">{t("events.groupName")} *</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t("events.enterGroupName")}
                  required={isGroupEvent}
                />
              </div>
            )}
            
            {/* Group Members Section (only for group events) */}
            {isGroupEvent && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-sm font-medium", isGeorgian ? "font-georgian" : "")}>
                    {t("events.groupMembers")} ({groupMembers.length})
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGroupParticipants(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("events.addMembers")}
                  </Button>
                </div>
                
                {groupMembers.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50">
                    {groupMembers.map((member, index) => (
                      <div key={member.id || index} className="text-sm py-1">
                        <span className="font-medium">{member.full_name}</span>
                        <span className="text-gray-600 ml-2">({member.email})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Regular event fields (hidden for group events or adjusted) */}
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
              hideCustomerFields={isGroupEvent}
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

      {/* Group Participants Modal */}
      <GroupParticipants
        open={showGroupParticipants}
        onOpenChange={setShowGroupParticipants}
        members={groupMembers}
        onMembersChange={setGroupMembers}
      />

      {/* Delete confirmation dialog */}
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
