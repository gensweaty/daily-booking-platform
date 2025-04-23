
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";
import { format } from "date-fns";

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
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  eventId?: string;
  isBookingRequest?: boolean;
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
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  eventId,
  isBookingRequest = false,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();

  const formattedMinDate = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  // If it's a booking request, we only show date and time fields
  if (isBookingRequest) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start-date">{t("events.startDateTime")}</Label>
            <Input
              id="start-date"
              type="datetime-local"
              min={formattedMinDate}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="end-date">{t("events.endDateTime")}</Label>
            <Input
              id="end-date"
              type="datetime-local"
              min={startDate || formattedMinDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // Set default times if no startDate or endDate is provided
    if (!startDate || !endDate) {
      const now = new Date();
      now.setHours(9, 0, 0, 0);
      const end = new Date(now);
      end.setHours(10, 0, 0, 0);
      
      setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(end, "yyyy-MM-dd'T'HH:mm"));
    }
  }, []);

  useEffect(() => {
    const formData = {
      title,
      userSurname,
      userNumber,
      socialNetworkLink,
      eventNotes,
      startDate,
      endDate,
      paymentStatus,
      paymentAmount,
    };
    sessionStorage.setItem('eventFormData', JSON.stringify(formData));
  }, [title, userSurname, userNumber, socialNetworkLink, eventNotes, startDate, endDate, paymentStatus, paymentAmount]);

  useEffect(() => {
    const savedFormData = sessionStorage.getItem('eventFormData');
    if (savedFormData && !title) {
      const parsedData = JSON.parse(savedFormData);
      setTitle(parsedData.title || '');
      setUserSurname(parsedData.userSurname || '');
      setUserNumber(parsedData.userNumber || '');
      setSocialNetworkLink(parsedData.socialNetworkLink || '');
      setEventNotes(parsedData.eventNotes || '');
      if (parsedData.startDate) setStartDate(parsedData.startDate);
      if (parsedData.endDate) setEndDate(parsedData.endDate);
      setPaymentStatus(parsedData.paymentStatus || '');
      setPaymentAmount(parsedData.paymentAmount || '');
    }
  }, []);

  useEffect(() => {
    if (!eventId) {
      sessionStorage.removeItem('eventFormData');
    }
  }, [eventId]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">{t("events.fullNameRequired")}</Label>
        <Input
          id="title"
          placeholder={t("events.fullName")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="number">{t("events.phoneNumber")}</Label>
        <Input
          id="number"
          type="tel"
          placeholder={t("events.phoneNumber")}
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("auth.emailLabel")}
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          required
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
          title="Please enter a valid email address"
        />
      </div>

      <div className="space-y-2">
        <Label>{t("events.dateAndTime")}</Label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate" className="text-sm text-muted-foreground mb-1">
              {t("events.startDateTime")}
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="bg-background border-input"
            />
          </div>
          <div>
            <Label htmlFor="endDate" className="text-sm text-muted-foreground mb-1">
              {t("events.endDateTime")}
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="bg-background border-input"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("events.paymentStatus")}</Label>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-full bg-background border-input">
            <SelectValue placeholder={t("events.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent className="bg-background border-input shadow-md">
            <SelectItem value="not_paid" className="hover:bg-muted focus:bg-muted">
              {t("crm.notPaid")}
            </SelectItem>
            <SelectItem value="partly" className="hover:bg-muted focus:bg-muted">
              {t("crm.paidPartly")}
            </SelectItem>
            <SelectItem value="fully" className="hover:bg-muted focus:bg-muted">
              {t("crm.paidFully")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {paymentStatus && paymentStatus !== 'not_paid' && (
        <div className="space-y-2">
          <Label htmlFor="amount">
            {t("events.paymentAmount")} ({language === 'es' ? '€' : '$'})
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder={`${t("events.paymentAmount")} ${language === 'es' ? '(€)' : '($)'}`}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
            className="bg-background border-input"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">{t("events.eventNotes")}</Label>
        <Textarea
          id="notes"
          placeholder={t("events.addEventNotes")}
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="bg-background border-input"
        />
      </div>

      <FileUploadField 
        onChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
        hideLabel={true}
      />
    </div>
  );
};
