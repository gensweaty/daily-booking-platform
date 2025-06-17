import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, FileText, Trash2, Users } from "lucide-react";
import { EventDialogFields } from "./EventDialogFields";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";
import { FileRecord } from "@/types/files";
import { GroupParticipant } from "./GroupBookingFields";
import { useGroupBooking } from "@/hooks/useGroupBooking";

interface Event {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  user_surname?: string;
  user_number?: string;
  social_network_link?: string;
  event_notes?: string;
  payment_status?: string;
  payment_amount?: number;
  is_group_event?: boolean;
  group_name?: string;
}

interface EventDialogProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: (event: any) => void;
  onEventUpdated?: (event: any) => void;
  onEventDeleted?: (eventId: string) => void;
  selectedDate?: Date;
}

export const EventDialog = ({
  event,
  isOpen,
  onClose,
  onEventCreated,
  onEventUpdated,
  onEventDeleted,
  selectedDate,
}: EventDialogProps) => {
  const [title, setTitle] = useState("");
  const [userSurname, setUserSurname] = useState("");
  const [userNumber, setUserNumber] = useState("");
  const [socialNetworkLink, setSocialNetworkLink] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("not_paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [displayedFiles, setDisplayedFiles] = useState<FileRecord[]>([]);

  // Group booking state
  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const { createGroupBooking, updateGroupBooking } = useGroupBooking();

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setStartDate(formatDateTime(event.start_date));
      setEndDate(formatDateTime(event.end_date));
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(event.payment_amount?.toString() || "");
      setIsGroupBooking(event.is_group_event || false);
      setGroupName(event.group_name || "");
      
      // Load group participants if it's a group event
      if (event.is_group_event) {
        loadGroupParticipants(event.id);
      }
    } else {
      // Reset for new event
      setTitle("");
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
      setIsGroupBooking(false);
      setGroupName("");
      setParticipants([]);
      
      if (selectedDate) {
        const startDateTime = new Date(selectedDate);
        startDateTime.setHours(9, 0);
        const endDateTime = new Date(selectedDate);
        endDateTime.setHours(10, 0);
        
        setStartDate(formatDateTime(startDateTime.toISOString()));
        setEndDate(formatDateTime(endDateTime.toISOString()));
      }
    }
    setSelectedFile(null);
    setFileError("");
  }, [event, selectedDate]);

  const loadGroupParticipants = async (eventId: string) => {
    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true);

      if (error) {
        console.error('Error loading group participants:', error);
        return;
      }

      const participantData: GroupParticipant[] = customers?.map(customer => ({
        id: customer.id,
        fullName: customer.user_surname || customer.title || '',
        email: customer.social_network_link || '',
        phoneNumber: customer.user_number || '',
        notes: customer.event_notes || '',
        paymentStatus: customer.payment_status || 'not_paid',
        paymentAmount: customer.payment_amount?.toString() || '',
      })) || [];

      setParticipants(participantData);
    } catch (error) {
      console.error('Error in loadGroupParticipants:', error);
    }
  };

  const loadEventFiles = async (eventId: string) => {
    try {
      const { data: files, error } = await supabase.rpc('get_all_related_files', {
        event_id_param: eventId,
        entity_name_param: title
      });

      if (error) {
        console.error('Error loading files:', error);
        return;
      }

      const fileRecords: FileRecord[] = files?.map(file => ({
        id: file.id,
        filename: file.filename,
        file_path: file.file_path,
        content_type: file.content_type,
        size: file.size,
        created_at: file.created_at,
        user_id: file.user_id,
        event_id: file.event_id,
        customer_id: file.customer_id,
        source: file.source,
      })) || [];

      setDisplayedFiles(fileRecords);
    } catch (error) {
      console.error('Error in loadEventFiles:', error);
    }
  };

  useEffect(() => {
    if (event?.id) {
      loadEventFiles(event.id);
    }
  }, [event?.id, title]);

  const handleFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to create events.",
        variant: "destructive",
      });
      return;
    }

    if (isGroupBooking && participants.length === 0) {
      toast({
        title: "No participants",
        description: "Please add at least one participant for group booking.",
        variant: "destructive",
      });
      return;
    }

    if (isGroupBooking && !groupName.trim()) {
      toast({
        title: "Group name required",
        description: "Please enter a group name for group booking.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const eventData = {
        title: isGroupBooking ? groupName : title,
        startDate,
        endDate,
        userSurname,
        userNumber,
        socialNetworkLink,
        eventNotes,
        userId: user.id,
      };

      if (isGroupBooking) {
        if (event) {
          // Update existing group booking
          await updateGroupBooking(event.id, eventData, groupName, participants);
          onEventUpdated?.(event);
        } else {
          // Create new group booking
          const newEvent = await createGroupBooking(eventData, groupName, participants);
          onEventCreated?.(newEvent);
        }
      } else {
        // Handle individual booking (existing logic)
        if (event) {
          // Update existing individual event
          const { error: updateError } = await supabase
            .from('events')
            .update({
              title,
              start_date: startDate,
              end_date: endDate,
              user_surname: userSurname,
              user_number: userNumber,
              social_network_link: socialNetworkLink,
              event_notes: eventNotes,
              payment_status: paymentStatus,
              payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
              is_group_event: false,
              group_name: null,
            })
            .eq('id', event.id);

          if (updateError) throw updateError;

          toast({
            title: "Event updated",
            description: "Your event has been updated successfully.",
          });

          onEventUpdated?.(event);
        } else {
          // Create new individual event
          const { data: newEvent, error: createError } = await supabase
            .from('events')
            .insert({
              title,
              start_date: startDate,
              end_date: endDate,
              user_surname: userSurname,
              user_number: userNumber,
              social_network_link: socialNetworkLink,
              event_notes: eventNotes,
              payment_status: paymentStatus,
              payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
              user_id: user.id,
              is_group_event: false,
              group_name: null,
            })
            .select()
            .single();

          if (createError) throw createError;

          toast({
            title: "Event created",
            description: "Your event has been created successfully.",
          });

          onEventCreated?.(newEvent);
        }
      }

      // Handle file upload if there's a selected file
      if (selectedFile && event?.id) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('event_attachments')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('File upload error:', uploadError);
        } else {
          const { error: fileRecordError } = await supabase
            .from('event_files')
            .insert({
              event_id: event.id,
              filename: selectedFile.name,
              file_path: filePath,
              content_type: selectedFile.type,
              size: selectedFile.size,
              user_id: user.id,
            });

          if (fileRecordError) {
            console.error('File record error:', fileRecordError);
          }
        }
      }

      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: "Error",
        description: "Failed to save event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !user) return;

    setIsLoading(true);
    try {
      if (event.is_group_event) {
        // Delete all group participants first
        const { error: participantsError } = await supabase
          .from('customers')
          .delete()
          .eq('parent_group_id', event.id)
          .eq('is_group_member', true);

        if (participantsError) throw participantsError;
      }

      // Soft delete the event
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: "Event deleted",
        description: "The event has been deleted successfully.",
      });

      onEventDeleted?.(event.id);
      onClose();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGroupBooking ? <Users className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
            {event ? (
              isGeorgian ? (
                <GeorgianAuthText>ღონისძიების რედაქტირება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.editEvent")}</LanguageText>
              )
            ) : (
              isGeorgian ? (
                <GeorgianAuthText>ახალი ღონისძიება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.newEvent")}</LanguageText>
              )
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
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
            displayedFiles={displayedFiles}
            onFileDeleted={handleFileDeleted}
            isGroupBooking={isGroupBooking}
            setIsGroupBooking={setIsGroupBooking}
            groupName={groupName}
            setGroupName={setGroupName}
            participants={participants}
            setParticipants={setParticipants}
          />
        </div>

        <DialogFooter className="flex gap-2">
          {event && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isGeorgian ? (
                <GeorgianAuthText>წაშლა</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.delete")}</LanguageText>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {isGeorgian ? (
              <GeorgianAuthText>გაუქმება</GeorgianAuthText>
            ) : (
              <LanguageText>{t("common.cancel")}</LanguageText>
            )}
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              isGeorgian ? (
                <GeorgianAuthText>ინახება...</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.saving")}</LanguageText>
              )
            ) : event ? (
              isGeorgian ? (
                <GeorgianAuthText>განახლება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.update")}</LanguageText>
              )
            ) : (
              isGeorgian ? (
                <GeorgianAuthText>შექმნა</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.create")}</LanguageText>
              )
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
