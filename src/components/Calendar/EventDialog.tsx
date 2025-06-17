
import { useState, useEffect } from "react";
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
  // State initialization
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

  // Improved group members loading with better error handling
  const loadGroupMembers = async (eventId: string): Promise<GroupMember[]> => {
    console.log("🔍 Loading group members for event:", eventId);
    setIsLoadingMembers(true);
    
    try {
      // Load group members from customers table
      const { data: groupMemberCustomers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true)
        .order('created_at', { ascending: true });

      console.log("📊 Database query result:", { 
        data: groupMemberCustomers, 
        error,
        eventId,
        queryFilters: {
          parent_group_id: eventId,
          is_group_member: true
        }
      });

      if (error) {
        console.error("❌ Error loading group members:", error);
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "common.errorOccurred"
          }
        });
        return [];
      }

      if (groupMemberCustomers && groupMemberCustomers.length > 0) {
        console.log("✅ Found group members:", groupMemberCustomers.length);
        
        const members: GroupMember[] = groupMemberCustomers.map((customer, index) => {
          console.log(`👤 Mapping member ${index + 1}:`, customer);
          return {
            id: customer.id,
            user_surname: customer.user_surname || customer.title || "",
            user_number: customer.user_number || "",
            social_network_link: customer.social_network_link || "", // Email field
            event_notes: customer.event_notes || "",
            payment_status: customer.payment_status || "not_paid",
            payment_amount: customer.payment_amount?.toString() || ""
          };
        });

        console.log("🎯 Mapped group members:", members);
        return members;
      }

      console.log("⚠️ No group members found for event:", eventId);
      return [];
    } catch (error) {
      console.error("💥 Exception loading group members:", error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
      return [];
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Initialize event data when dialog opens
  useEffect(() => {
    const initializeEventData = async () => {
      console.log("🚀 Initializing event data, dialog open:", open, "event:", event);
      
      if (!open) return;

      if (event) {
        console.log("📝 Processing existing event:", event);
        
        const start = new Date(event.start_date);
        const end = new Date(event.end_date);
        
        // Check if this is a group event
        const eventIsGroupEvent = Boolean(event.is_group_event);
        console.log("🔍 Is group event?", eventIsGroupEvent, "event.is_group_event:", event.is_group_event);
        
        // Set dates first
        const formattedStart = format(start, "yyyy-MM-dd'T'HH:mm");
        const formattedEnd = format(end, "yyyy-MM-dd'T'HH:mm");
        
        setStartDate(formattedStart);
        setEndDate(formattedEnd);
        setOriginalStartDate(formattedStart);
        setOriginalEndDate(formattedEnd);
        
        // Set payment info
        let normalizedStatus = event.payment_status || "not_paid";
        if (normalizedStatus.includes('partly')) normalizedStatus = 'partly_paid';
        else if (normalizedStatus.includes('fully')) normalizedStatus = 'fully_paid';
        else if (normalizedStatus.includes('not')) normalizedStatus = 'not_paid';
        
        setPaymentStatus(normalizedStatus);
        setPaymentAmount(event.payment_amount?.toString() || "");
        
        // Set group event state FIRST
        setIsGroupEvent(eventIsGroupEvent);
        
        if (eventIsGroupEvent) {
          console.log("🎭 Processing group event");
          // For group events
          const groupEventName = event.group_name || event.title || "";
          console.log("🏷️ Group name:", groupEventName);
          
          setGroupName(groupEventName);
          setTitle(groupEventName);
          
          // Clear individual fields for group events
          setUserSurname("");
          setUserNumber("");
          setSocialNetworkLink("");
          setEventNotes("");
          
          // Load group members if event has an ID
          if (event.id) {
            console.log("👥 Loading group members for event ID:", event.id);
            const members = await loadGroupMembers(event.id);
            console.log("📋 Setting group members:", members);
            setGroupMembers(members);
          }
        } else {
          console.log("👤 Processing individual event");
          // For individual events
          const fullName = event.user_surname || event.title || "";
          setTitle(fullName);
          setUserSurname(fullName);
          setUserNumber(event.user_number || event.requester_phone || "");
          setSocialNetworkLink(event.social_network_link || event.requester_email || "");
          setEventNotes(event.event_notes || event.description || "");
          
          // Clear group fields
          setGroupName("");
          setGroupMembers([]);
        }
        
        setIsBookingEvent(event.type === 'booking_request');
        
      } else if (selectedDate) {
        console.log("📅 Creating new event for date:", selectedDate);
        
        // Reset everything for new events
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
        
        // Reset all fields
        setTitle("");
        setUserSurname("");
        setUserNumber("");
        setSocialNetworkLink("");
        setEventNotes("");
        setPaymentAmount("");
        
        // Reset group event state
        setIsGroupEvent(false);
        setGroupName("");
        setGroupMembers([]);
      }
    };

    initializeEventData();
  }, [open, event, selectedDate]);

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
          console.error("Error loading event files:", eventFilesError);
        }
        
        let allFiles = [];
        
        if (eventFiles && eventFiles.length > 0) {
          const filesWithSource = eventFiles.map(file => ({
            ...file,
            parentType: 'event'
          }));
          allFiles = [...filesWithSource];
        }
        
        if (event.customer_id) {
          const { data: customerFiles, error: customerFilesError } = await supabase
            .from('customer_files_new')
            .select('*')
            .eq('customer_id', event.customer_id);
            
          if (customerFilesError) {
            console.error("Error loading customer files:", customerFilesError);
          } else if (customerFiles && customerFiles.length > 0) {
            const customerFilesWithSource = customerFiles.map(file => ({
              ...file,
              parentType: 'customer',
              id: file.id
            }));
            
            allFiles = [...allFiles, ...customerFilesWithSource];
          }
        }
        
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
    
    console.log("💾 Starting form submission", {
      isGroupEvent,
      groupName,
      groupMembersCount: groupMembers.length,
      title,
      userSurname
    });
    
    const finalTitle = isGroupEvent ? groupName : userSurname;
    
    if (!finalTitle.trim()) {
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "events.titleRequired"
        }
      });
      return;
    }
    
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    const timesChanged = startDate !== originalStartDate || endDate !== originalEndDate;
    console.log("Time changed during edit?", timesChanged);

    const wasBookingRequest = event?.type === 'booking_request';
    
    let normalizedPaymentStatus = paymentStatus;
    if (normalizedPaymentStatus.includes('partly')) normalizedPaymentStatus = 'partly_paid';
    else if (normalizedPaymentStatus.includes('fully')) normalizedPaymentStatus = 'fully_paid';
    else if (normalizedPaymentStatus.includes('not')) normalizedPaymentStatus = 'not_paid';
    
    const eventData: Partial<CalendarEventType> = {
      title: finalTitle,
      user_surname: isGroupEvent ? "" : userSurname,
      user_number: isGroupEvent ? "" : userNumber,
      social_network_link: isGroupEvent ? "" : socialNetworkLink,
      event_notes: isGroupEvent ? "" : eventNotes,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      payment_status: isGroupEvent ? "not_paid" : normalizedPaymentStatus,
      payment_amount: isGroupEvent ? null : (paymentAmount ? parseFloat(paymentAmount) : null),
      language: event?.language || language,
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
    } else if (event?.type) {
      eventData.type = event.type;
    } else {
      eventData.type = 'event';
    }

    try {
      console.log("🚀 Submitting event data:", eventData);
      const createdEvent = await onSubmit(eventData);
      console.log('✅ Event created/updated:', createdEvent);
      
      // Handle group members if this is a group event
      if (isGroupEvent && groupMembers.length > 0 && createdEvent?.id && user) {
        console.log("👥 Processing group members:", groupMembers.length);
        
        try {
          // First, delete existing group members if updating
          if (event?.id) {
            console.log("🗑️ Deleting existing group members for event:", event.id);
            
            const { data: existingMembers, error: findError } = await supabase
              .from('customers')
              .select('id')
              .eq('parent_group_id', event.id)
              .eq('is_group_member', true);
              
            if (findError) {
              console.error('Error finding existing group members:', findError);
            } else if (existingMembers && existingMembers.length > 0) {
              console.log("🗑️ Found existing members to delete:", existingMembers.length);
              
              const { error: deleteError } = await supabase
                .from('customers')
                .delete()
                .eq('parent_group_id', event.id)
                .eq('is_group_member', true);
                
              if (deleteError) {
                console.error('❌ Error deleting existing group members:', deleteError);
              } else {
                console.log('✅ Deleted existing group members');
              }
            }
          }

          // Create individual customer records for each group member
          console.log("📝 Creating new group member records");
          
          for (let i = 0; i < groupMembers.length; i++) {
            const member = groupMembers[i];
            console.log(`👤 Creating member ${i + 1}/${groupMembers.length}:`, member);
            
            const customerData = {
              title: member.user_surname || `Group Member ${i + 1}`,
              user_surname: member.user_surname,
              user_number: member.user_number,
              social_network_link: member.social_network_link, // Email
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

            console.log("💾 Inserting customer data:", customerData);

            const { data: insertedCustomer, error: customerError } = await supabase
              .from('customers')
              .insert(customerData)
              .select()
              .single();

            if (customerError) {
              console.error('❌ Error creating group member customer:', customerError);
              toast({
                translateKeys: {
                  titleKey: "common.error",
                  descriptionKey: "common.errorOccurred"
                }
              });
            } else {
              console.log('✅ Created customer for group member:', insertedCustomer);
            }
          }
          
          console.log("🎉 All group members processed successfully");
          
        } catch (groupError) {
          console.error("💥 Error handling group members:", groupError);
          toast({
            translateKeys: {
              titleKey: "common.error",
              descriptionKey: "common.errorOccurred"
            }
          });
        }
      }
      
      // Handle file upload
      if (selectedFile && createdEvent?.id && user) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${createdEvent.id}/${crypto.randomUUID()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('event_attachments')
            .upload(filePath, selectedFile);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
          } else {
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
            }
          }
        } catch (fileError) {
          console.error("Error handling file upload:", fileError);
        }
      }

      // Update booking request if needed
      if (isBookingEvent && event?.id) {
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
            }
          }
        } catch (bookingError) {
          console.error("Error updating booking request:", bookingError);
        }
      }

      onOpenChange(false);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['business-events'] });
      queryClient.invalidateQueries({ queryKey: ['approved-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: isGroupEvent 
            ? (event?.id ? "events.groupEventUpdated" : "events.groupEventCreated")
            : (event?.id ? "events.eventUpdated" : "events.eventCreated")
        }
      });
      
    } catch (error: any) {
      console.error('💥 Error handling event submission:', error);
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
          // Make dialog wider for group events to accommodate member cards
          isGroupEvent ? "max-w-5xl w-[95vw]" : "max-w-2xl w-[90vw]"
        )}>
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")}>
            {event ? t("events.editEvent") : t("events.addNewEvent")}
            {isLoadingMembers && isGroupEvent && (
              <span className="ml-2 text-sm text-muted-foreground">
                {t("common.loading")}...
              </span>
            )}
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
              <Button type="submit" className="flex-1" disabled={isLoadingMembers}>
                {event ? t("events.updateEvent") : t("events.createEvent")}
              </Button>
              {event && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={handleDeleteClick}
                  disabled={isLoadingMembers}
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
