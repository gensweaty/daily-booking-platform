
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dispatch, SetStateAction } from "react";

export interface EventDialogFieldsProps {
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  userSurname: string;
  setUserSurname: Dispatch<SetStateAction<string>>;
  userNumber: string;
  setUserNumber: Dispatch<SetStateAction<string>>;
  socialNetworkLink: string;
  setSocialNetworkLink: Dispatch<SetStateAction<string>>;
  eventNotes: string;
  setEventNotes: Dispatch<SetStateAction<string>>;
  startDate: Date | null;
  setStartDate: Dispatch<SetStateAction<Date | null>>;
  endDate: Date | null;
  setEndDate: Dispatch<SetStateAction<Date | null>>;
  eventType: "birthday" | "private_party";
  setEventType: Dispatch<SetStateAction<"birthday" | "private_party">>;
  paymentStatus: string;
  setPaymentStatus: Dispatch<SetStateAction<string>>;
  paymentAmount: number;
  setPaymentAmount: Dispatch<SetStateAction<number>>;
  file: File | null;
  setFile: Dispatch<SetStateAction<File | null>>;
  fileError: string;
  setFileError: Dispatch<SetStateAction<string>>;
  isEditingDisabled?: boolean;
  isPublic?: boolean;
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
  eventType,
  setEventType,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  file,
  setFile,
  fileError,
  setFileError,
  isEditingDisabled = false,
  isPublic = false,
}: EventDialogFieldsProps) => {
  const { t } = useLanguage();

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">{t("events.title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={isEditingDisabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userSurname">{t("events.clientName")}</Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          disabled={isEditingDisabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userNumber">{t("events.contactNumber")}</Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          disabled={isEditingDisabled}
        />
      </div>

      {/* On public view, hide social media link */}
      {!isPublic && (
        <div className="space-y-2">
          <Label htmlFor="socialNetworkLink">{t("events.socialMediaLink")}</Label>
          <Input
            id="socialNetworkLink"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            disabled={isEditingDisabled}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="event_notes">{t("events.eventNotes")}</Label>
        <Textarea
          id="event_notes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          className="h-20"
          disabled={isEditingDisabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("events.startDate")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
                disabled={isEditingDisabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP p") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate || undefined}
                onSelect={setStartDate}
                initialFocus
              />
              <div className="p-3 border-t border-border">
                <Label>{t("events.startTime")}</Label>
                <Input
                  type="time"
                  value={startDate ? format(startDate, "HH:mm") : ""}
                  onChange={(e) => {
                    if (startDate) {
                      const [hours, minutes] = e.target.value.split(":");
                      const newDate = new Date(startDate);
                      newDate.setHours(Number(hours), Number(minutes));
                      setStartDate(newDate);
                    }
                  }}
                  className="mt-2"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>{t("events.endDate")}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
                disabled={isEditingDisabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP p") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate || undefined}
                onSelect={setEndDate}
                initialFocus
              />
              <div className="p-3 border-t border-border">
                <Label>{t("events.endTime")}</Label>
                <Input
                  type="time"
                  value={endDate ? format(endDate, "HH:mm") : ""}
                  onChange={(e) => {
                    if (endDate) {
                      const [hours, minutes] = e.target.value.split(":");
                      const newDate = new Date(endDate);
                      newDate.setHours(Number(hours), Number(minutes));
                      setEndDate(newDate);
                    }
                  }}
                  className="mt-2"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("events.eventType")}</Label>
        <RadioGroup
          value={eventType}
          onValueChange={(value) => setEventType(value as "birthday" | "private_party")}
          className="flex space-x-4"
          disabled={isEditingDisabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="birthday" id="birthday" />
            <Label htmlFor="birthday" className="cursor-pointer">
              {t("events.birthday")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="private_party" id="private_party" />
            <Label htmlFor="private_party" className="cursor-pointer">
              {t("events.privateParty")}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Hide payment fields in public view */}
      {!isPublic && (
        <>
          <div className="space-y-2">
            <Label htmlFor="paymentStatus">{t("events.paymentStatus")}</Label>
            <Input
              id="paymentStatus"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              disabled={isEditingDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentAmount">{t("events.paymentAmount")}</Label>
            <Input
              id="paymentAmount"
              type="number"
              value={paymentAmount || ""}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              disabled={isEditingDisabled}
            />
          </div>

          <FileUploadField
            onFileChange={setFile}
            fileError={fileError}
            setFileError={setFileError}
          />
        </>
      )}
    </>
  );
};
