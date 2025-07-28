import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { CalendarEventType } from "@/lib/types/calendar";
import { Calendar } from "@/components/ui/calendar";
import { History } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { georgianLocale } from "@/lib/dateLocalization";

interface EventDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  eventName: string;
  setEventName: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  existingFiles: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>;
  setExistingFiles: (files: Array<{
    id: string;
    event_id: string;
    filename: string;
    file_path: string;
    content_type?: string;
    size?: number;
  }>) => void;
  eventId: string;
  isBookingRequest: boolean;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  isNewEvent: boolean;
  additionalPersons: any[];
  setAdditionalPersons: (persons: any[]) => void;
  isVirtualEvent: boolean;
  eventData?: CalendarEventType;
}

export const EventDialogFields = ({
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  eventNotes,
  setEventNotes,
  eventName,
  setEventName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  files,
  setFiles,
  existingFiles,
  setExistingFiles,
  eventId,
  isBookingRequest,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  isNewEvent,
  additionalPersons,
  setAdditionalPersons,
  isVirtualEvent,
  eventData
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();

  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      const date = parseISO(dateString);
      if (language === 'ka') {
        return format(date, 'dd/MM/yyyy HH:mm', { locale: georgianLocale });
      } else if (language === 'es') {
        return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
      } else {
        return format(date, 'dd/MM/yyyy HH:mm');
      }
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">
            <LanguageText>{t("events.startDate")}</LanguageText>
          </Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={startDate ? startDate.slice(0, 16) : ''}
            onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="w-full"
          />
        </div>
        <div>
          <Label htmlFor="endDate">
            <LanguageText>{t("events.endDate")}</LanguageText>
          </Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={endDate ? endDate.slice(0, 16) : ''}
            onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="w-full"
          />
        </div>
      </div>

      {/* Created and Updated Information */}
      {eventData && !isNewEvent && (
        <div className="px-2 py-1.5 rounded-md border border-muted/30 bg-muted/20 w-fit">
          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              <span>{t("common.created")}: {formatDate(eventData.created_at)}</span>
            </div>
            <div className="flex items-center">
              <History className="w-3 h-3 mr-1" />
              <span>{t("common.lastUpdated")}: {formatDate(eventData.updated_at || eventData.created_at)}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          <LanguageText>{t("events.personData")}</LanguageText>
        </h3>
        
        <div>
          <Label htmlFor="userSurname">
            <LanguageText>{t("events.surname")}</LanguageText>
          </Label>
          <Input
            id="userSurname"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
            placeholder={t("events.surname")}
          />
        </div>

        <div>
          <Label htmlFor="userNumber">
            <LanguageText>{t("events.phoneNumber")}</LanguageText>
          </Label>
          <Input
            id="userNumber"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            placeholder={t("events.phoneNumber")}
          />
        </div>

        <div>
          <Label htmlFor="socialNetworkLink">
            <LanguageText>{t("events.socialNetwork")}</LanguageText>
          </Label>
          <Input
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder={t("events.socialNetwork")}
          />
        </div>

        <div>
          <Label htmlFor="eventNotes">
            <LanguageText>{t("events.notes")}</LanguageText>
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={t("events.notes")}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="eventName">
            <LanguageText>{t("events.eventName")}</LanguageText>
          </Label>
          <Input
            id="eventName"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder={t("events.eventName")}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          <LanguageText>{t("events.payment")}</LanguageText>
        </h3>
        
        <div>
          <Label htmlFor="paymentStatus">
            <LanguageText>{t("events.paymentStatus")}</LanguageText>
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger>
              <SelectValue placeholder={t("events.selectPaymentStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_paid">
                <LanguageText>{t("events.notPaid")}</LanguageText>
              </SelectItem>
              <SelectItem value="paid">
                <LanguageText>{t("events.paid")}</LanguageText>
              </SelectItem>
              <SelectItem value="partial">
                <LanguageText>{t("events.partialPayment")}</LanguageText>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="paymentAmount">
            <LanguageText>{t("events.paymentAmount")}</LanguageText>
          </Label>
          <Input
            id="paymentAmount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder={t("events.paymentAmount")}
          />
        </div>
      </div>
    </div>
  );
};
