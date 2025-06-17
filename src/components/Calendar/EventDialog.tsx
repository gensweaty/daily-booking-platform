import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { CalendarEventType, GroupParticipant } from "@/lib/types/calendar";
import { Trash2, AlertCircle, Users, User } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { GroupParticipants } from "./GroupParticipants";
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
  // Individual event fields - keep existing code the same
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
  
  // Group event fields
  const [isGroupEvent, setIsGroupEvent] = useState(event?.is_group_event || false);
  const [groupName, setGroupName] = useState(event?.group_name || "");
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [isBookingEvent, setIsBookingEvent] = useState(false);
  const isGeorgian = language === 'ka';
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Synchronize fields when event data changes or when dialog opens
  useEffect(() => {
    if (event) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      
      console.log("Loading event data:", event);
      
      const fullName = event.user_surname || event.title || "";
      setTitle(fullName);
      setUserSurname(fullName);
      
      setUserNumber(event.user_number || event.requester_phone || "");
      setSocialNetworkLink(event.social_network_link || event.requester_email || "");
      setEventNotes(event.event_notes || event.description || "");
      
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
      
      // Group event specific loading
      setIsGroupEvent(event.is_group_event || false);
      setGroupName(event.group_name || "");
      
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
      
      // Reset group fields for new events
      setIsGroupEvent(false);
      setGroupName("");
      setParticipants([]);
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
        
        const { data: eventFiles, error: eventFilesError } = await supabase
          .from('event_files')
          .select('*')
          .eq('event_id', event.id);
            
        if (eventFilesError) {
          console.error("Error loading event files:", eventFilesError);
        }
        
        let allFiles = [];
        
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

  // Initialize participants for new group events
  useEffect(() => {
    if (isGroupEvent && participants.length === 0 && !event?.id) {
      setParticipants([{
        user_surname: "",
        user_number: "",
        social_network_link: "",
        event_notes: "",
        payment_status: "not_paid",
        payment_amount: 0
      }]);
    }
  }, [isGroupEvent, participants.length, event?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    let normalizedPaymentStatus = paymentStatus;
    if (normalizedPaymentStatus.includes('partly')) normalizedPaymentStatus = 'partly_paid';
    else if (normalizedPaymentStatus.includes('fully')) normalizedPaymentStatus = 'fully_paid';
    else if (normalizedPaymentStatus.includes('not')) normalizedPaymentStatus = 'not_paid';
    
    console.log("Submitting with payment status:", normalizedPaymentStatus);

    try {
      if (isGroupEvent) {
        // Handle group event creation/update
        const groupEventData: Partial<CalendarEventType> = {
          title: groupName,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          type: event?.type || 'event',
          is_group_event: true,
          group_name: groupName,
          language: event?.language || language,
        };

        if (event?.id) {
          groupEventData.id = event.id;
        }

        // Create/update parent group event
        const parentEvent = await onSubmit(groupEventData);
        console.log('Created/Updated parent group event:', parentEvent);

        // Create individual events for each participant
        for (const participant of participants) {
          if (participant.user_surname.trim()) { // Only create if name is provided
            const participantEventData: Partial<CalendarEventType> = {
              title: participant.user_surname,
              user_surname: participant.user_surname,
              user_number: participant.user_number,
              social_network_link: participant.social_network_link,
              event_notes: participant.event_notes,
              start_date: startDateTime.toISOString(),
              end_date: endDateTime.toISOString(),
              payment_status: participant.payment_status,
              payment_amount: participant.payment_amount,
              type: 'event',
              parent_group_id: parentEvent.id,
              language: event?.language || language,
            };

            await onSubmit(participantEventData);
            
            // Create customer record for CRM
            if (user?.id) {
              await supabase.from('customers').insert({
                title: participant.user_surname,
                user_surname: participant.user_surname,
                user_number: participant.user_number,
                social_network_link: participant.social_network_link,
                event_notes: participant.event_notes,
                payment_status: participant.payment_status,
                payment_amount: participant.payment_amount,
                start_date: startDateTime.toISOString(),
                end_date: endDateTime.toISOString(),
                user_id: user.id,
                type: 'group_member'
              });
            }
          }
        }

        toast({
          translateKeys: {
            titleKey: "common.success",
            descriptionKey: event?.id ? "events.eventUpdated" : "events.eventCreated"
          }
        });
      } else {
        // Handle individual event - keep existing logic the same
        const finalTitle = userSurname;
        
        const eventData: Partial<CalendarEventType> = {
          title: finalTitle,
          user_surname: userSurname,
          user_number: userNumber,
          social_network_link: socialNetworkLink,
          event_notes: eventNotes,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          payment_status: normalizedPaymentStatus,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          language: event?.language || language,
          is_group_event: false,
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
          eventData.type = 'event';
        }

        console.log("EventDialog - Submitting event data:", eventData);
        const createdEvent = await onSubmit(eventData);
        console.log('Created/Updated event:', createdEvent);
        
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
            {!event?.id && (
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <Switch
                  id="group-event"
                  checked={isGroupEvent}
                  onCheckedChange={setIsGroupEvent}
                />
                <div className="flex items-center space-x-2">
                  {isGroupEvent ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  <Label htmlFor="group-event" className={cn("text-sm", isGeorgian ? "font-georgian" : "")}>
                    {isGroupEvent ? "Group Event" : "Individual Event"}
                  </Label>
                </div>
              </div>
            )}

            {/* Group Name Field */}
            {isGroupEvent && (
              <div>
                <Label htmlFor="groupName" className={cn(isGeorgian ? "font-georgian" : "")}>
                  Group Name
                </Label>
                <Input
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  required
                  className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
                />
              </div>
            )}

            {/* Date and Time fields for both individual and group */}
            <div>
              <Label htmlFor="dateTime" className={cn(isGeorgian ? "font-georgian" : "")}>
                Date and Time
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                    Start
                  </Label>
                  <div className="relative">
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full dark:text-white dark:[color-scheme:dark]"
                      style={{ colorScheme: 'auto' }}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                    End
                  </Label>
                  <div className="relative">
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full dark:text-white dark:[color-scheme:dark]"
                      style={{ colorScheme: 'auto' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Conditional rendering based on event type */}
            {isGroupEvent ? (
              <GroupParticipants
                participants={participants}
                setParticipants={setParticipants}
              />
            ) : (
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
              />
            )}
            
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

      {/* Add deletion confirmation dialog */}
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
