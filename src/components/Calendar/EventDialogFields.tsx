
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventFilesList } from "./EventFilesList";
import { cn } from "@/lib/utils";

interface EventDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  startDate: Date;
  setStartDate: (date: Date) => void;
  endDate: Date;
  setEndDate: (date: Date) => void;
  eventId?: string | null;
  displayedFiles?: any[];
  onFileDeleted?: (fileId: string) => void;
}

export const EventDialogFields: React.FC<EventDialogFieldsProps> = ({
  title,
  setTitle,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  eventNotes,
  setEventNotes,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  eventId,
  displayedFiles = [],
  onFileDeleted,
}) => {
  const { t } = useLanguage();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel'];
      
      if (file.size > maxSize) {
        setFileError("File is too large. Maximum size is 5MB");
        setSelectedFile(null);
      } else if (!allowedTypes.includes(file.type)) {
        setFileError("Invalid file type. Only JPG, JPEG, PNG, PDF, DOCX and XLS are allowed");
        setSelectedFile(null);
      } else {
        setFileError("");
        setSelectedFile(file);
      }
    }
  };

  return (
    <>
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <Label htmlFor="title">{t("events.title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
            />
          </div>
          <div>
            <Label htmlFor="user_number">{t("crm.phoneNumber")}</Label>
            <Input
              id="user_number"
              value={userNumber}
              onChange={(e) => setUserNumber(e.target.value)}
              placeholder={t("crm.phoneNumberPlaceholder")}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="social_network">{t("crm.socialLinkEmail")}</Label>
          <Input
            id="social_network"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            placeholder={t("crm.socialLinkEmailPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <Label>{t("events.startDateTime")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full pl-3 text-left font-normal bg-white dark:bg-gray-950",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    {startDate ? (
                      format(startDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                  />
                </PopoverContent>
              </Popover>

              <div className="flex">
                <Input
                  type="time"
                  value={format(startDate, "HH:mm")}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(":");
                    const newDate = new Date(startDate);
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setStartDate(newDate);
                  }}
                  className="rounded-r-none"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>{t("events.endDateTime")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full pl-3 text-left font-normal bg-white dark:bg-gray-950",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                  />
                </PopoverContent>
              </Popover>

              <div className="flex">
                <Input
                  type="time"
                  value={format(endDate, "HH:mm")}
                  onChange={(e) => {
                    const [hours, minutes] = e.target.value.split(":");
                    const newDate = new Date(endDate);
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setEndDate(newDate);
                  }}
                  className="rounded-r-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <Label htmlFor="payment_status">{t("crm.paymentStatus")}</Label>
            <Select
              value={paymentStatus}
              onValueChange={(value) => setPaymentStatus(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("crm.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-950">
                <SelectGroup>
                  <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
                  <SelectItem value="partly_paid">{t("crm.paidPartly")}</SelectItem>
                  <SelectItem value="fully_paid">{t("crm.paidFully")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="payment_amount">{t("crm.paymentAmount")}</Label>
            <Input
              id="payment_amount"
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="event_notes">{t("events.eventNotes")}</Label>
          <Textarea
            id="event_notes"
            className="h-20"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={t("events.addEventNotes")}
          />
        </div>

        <div>
          <Label htmlFor="file">{t("common.attachments")}</Label>
          <Input
            id="file"
            type="file"
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.pdf,.docx,.xls"
          />
          {fileError && (
            <p className="text-red-500 text-sm mt-1">{fileError}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t("common.supportedFormats")}
          </p>
        </div>

        {displayedFiles && displayedFiles.length > 0 && (
          <div className="mt-2">
            <EventFilesList files={displayedFiles} onDelete={onFileDeleted} />
          </div>
        )}
      </div>
    </>
  );
};
