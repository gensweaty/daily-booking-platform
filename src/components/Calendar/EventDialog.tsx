
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { EventDialogFields } from "./EventDialogFields";
import { GroupMembersManager, GroupMember } from "./GroupMembersManager";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { cn } from "@/lib/utils";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  event?: CalendarEventType;
  onSubmit: (eventData: Partial<CalendarEventType>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const EventDialog = ({
  open,
  onOpenChange,
  selectedDate,
  event,
  onSubmit,
  onDelete,
}: EventDialogProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [isGroupEvent, setIsGroupEvent] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  
  // Regular event fields
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
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);

  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  // Initialize form when event or selectedDate changes
  useEffect(() => {
    if (event) {
      // Editing existing event
      setIsGroupEvent(event.is_group_event || false);
      setGroupName(event.group_name || "");
      setTitle(event.title || "");
      setUserSurname(event.user_surname || "");
      setUserNumber(event.user_number || "");
      setSocialNetworkLink(event.social_network_link || "");
      setEventNotes(event.event_notes || "");
      setPaymentStatus(event.payment_status || "not_paid");
      setPaymentAmount(event.payment_amount?.toString() || "");
      setStartDate(format(new Date(event.start_date), "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(new Date(event.end_date), "yyyy-MM-dd'T'HH:mm"));
      setDisplayedFiles(event.files || []);
      
      // TODO: Load group members if it's a group event
      if (event.is_group_event) {
        // For now, initialize with empty array - will be populated when we implement loading
        setGroupMembers([]);
      }
    } else if (selectedDate) {
      // Creating new event
      resetForm();
      const defaultStart = format(selectedDate, "yyyy-MM-dd'T'HH:mm");
      const defaultEnd = format(new Date(selectedDate.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm");
      setStartDate(defaultStart);
      setEndDate(defaultEnd);
    }
  }, [event, selectedDate]);

  const resetForm = () => {
    setIsGroupEvent(false);
    setGroupName("");
    setGroupMembers([{
      id: crypto.randomUUID(),
      fullName: "",
      email: "",
      phoneNumber: "",
      paymentStatus: "not_paid",
      paymentAmount: "",
      notes: ""
    }]);
    setTitle("");
    setUserSurname("");
    setUserNumber("");
    setSocialNetworkLink("");
    setEventNotes("");
    setPaymentStatus("not_paid");
    setPaymentAmount("");
    setSelectedFile(null);
    setFileError("");
    setDisplayedFiles([]);
  };

  const handleGroupToggle = (checked: boolean) => {
    setIsGroupEvent(checked);
    if (checked) {
      // When switching to group mode, initialize with one member
      if (groupMembers.length === 0) {
        setGroupMembers([{
          id: crypto.randomUUID(),
          fullName: userSurname,
          email: socialNetworkLink,
          phoneNumber: userNumber,
          paymentStatus: paymentStatus,
          paymentAmount: paymentAmount,
          notes: eventNotes
        }]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isGroupEvent) {
        // Group event submission
        if (!groupName.trim()) {
          throw new Error("Group name is required");
        }
        if (groupMembers.length === 0) {
          throw new Error("At least one group member is required");
        }
        
        const eventData: Partial<CalendarEventType> = {
          id: event?.id,
          title: groupName,
          is_group_event: true,
          group_name: groupName,
          start_date: startDate,
          end_date: endDate,
          type: "group_event",
          group_members: groupMembers,
          file: selectedFile,
        };
        
        await onSubmit(eventData);
      } else {
        // Individual event submission (existing logic)
        const eventData: Partial<CalendarEventType> = {
          id: event?.id,
          title: title || userSurname,
          user_surname: userSurname,
          user_number: userNumber,
          social_network_link: socialNetworkLink,
          event_notes: eventNotes,
          start_date: startDate,
          end_date: endDate,
          payment_status: paymentStatus,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
          type: "private_party",
          file: selectedFile,
        };
        
        await onSubmit(eventData);
      }
      
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error submitting event:", error);
    }
  };

  const handleDelete = async () => {
    if (event?.id && onDelete) {
      await onDelete(event.id);
      onOpenChange(false);
    }
  };

  const onFileDeleted = (fileId: string) => {
    setDisplayedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {event ? (
              <LanguageText>{t("events.editEvent")}</LanguageText>
            ) : (
              <LanguageText>{t("events.addNewEvent")}</LanguageText>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Event Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="group-event"
              checked={isGroupEvent}
              onCheckedChange={handleGroupToggle}
            />
            <Label htmlFor="group-event" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? <GeorgianAuthText>ჯგუფური ღონისძიება</GeorgianAuthText> : <LanguageText>{t("events.groupEvent")}</LanguageText>}
            </Label>
          </div>

          {isGroupEvent ? (
            <>
              {/* Group Name Field */}
              <div>
                <Label htmlFor="groupName" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  {isGeorgian ? <GeorgianAuthText>ღონისძიების სახელი</GeorgianAuthText> : <LanguageText>{t("events.eventName")}</LanguageText>}
                </Label>
                <Input
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={isGeorgian ? "ღონისძიების სახელი" : t("events.eventName")}
                  required
                  className={cn(isGeorgian ? "font-georgian placeholder:font-georgian" : "")}
                  style={georgianStyle}
                />
              </div>

              {/* Date and Time */}
              <div>
                <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  <LanguageText>{t("events.dateAndTime")}</LanguageText>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">დაწყება</GeorgianAuthText> : <LanguageText>{t("events.start")}</LanguageText>}
                    </Label>
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
                  <div>
                    <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? <GeorgianAuthText letterSpacing="-0.05px">დასრულება</GeorgianAuthText> : <LanguageText>{t("events.end")}</LanguageText>}
                    </Label>
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

              {/* Group Members Manager */}
              <GroupMembersManager
                members={groupMembers}
                onMembersChange={setGroupMembers}
              />
            </>
          ) : (
            /* Regular Event Fields */
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
              onFileDeleted={onFileDeleted}
              isBookingRequest={false}
            />
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div>
              {event && onDelete && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  <LanguageText>{t("common.delete")}</LanguageText>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <LanguageText>{t("common.cancel")}</LanguageText>
              </Button>
              <Button type="submit">
                {event ? (
                  <LanguageText>{t("common.save")}</LanguageText>
                ) : (
                  <LanguageText>{t("events.createEvent")}</LanguageText>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
