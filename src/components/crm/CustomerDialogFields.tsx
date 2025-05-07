
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FileRecord } from "@/types/files";

interface CustomerDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  createEvent: boolean;
  setCreateEvent: (value: boolean) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  customerNotes: string;
  setCustomerNotes: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  isEventBased?: boolean;
  startDate?: string;
  endDate?: string;
  customerId?: string | null;
  displayedFiles?: FileRecord[];
  onFileDeleted?: (fileId: string) => void;
  eventStartDate: Date;
  setEventStartDate: (date: Date) => void;
  eventEndDate: Date;
  setEventEndDate: (date: Date) => void;
  bucketName?: string;
}

export const CustomerDialogFields = ({
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  createEvent,
  setCreateEvent,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  customerNotes,
  setCustomerNotes,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  isEventBased = false,
  startDate,
  endDate,
  customerId,
  displayedFiles = [],
  onFileDeleted,
  eventStartDate,
  setEventStartDate,
  eventEndDate,
  setEventEndDate,
  bucketName = 'customer_attachments'
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();

  return (
    <>
      <div>
        <Label htmlFor="title">{t("crm.customerFullName")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("crm.customerFullName")}
          required
        />
      </div>

      <div>
        <Label htmlFor="userNumber">{t("crm.phoneNumber")}</Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder={t("crm.phoneNumber")}
        />
      </div>

      <div>
        <Label htmlFor="socialNetworkLink">{t("crm.emailOrSocialLink")}</Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder={t("crm.emailOrSocialLink")}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox 
          id="createEvent" 
          checked={createEvent} 
          onCheckedChange={(checked) => setCreateEvent(checked as boolean)} 
        />
        <Label htmlFor="createEvent" className="cursor-pointer">
          {t("crm.createCorrespondingEvent")}
        </Label>
      </div>

      {createEvent && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("crm.startDate")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventStartDate ? format(eventStartDate, 'PPP HH:mm') : <span>{t("crm.pickDate")}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={eventStartDate}
                  onSelect={(date) => date && setEventStartDate(date)}
                  initialFocus
                />
                <div className="p-3 border-t border-border">
                  <Input
                    type="time"
                    value={format(eventStartDate, 'HH:mm')}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(eventStartDate);
                      newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                      setEventStartDate(newDate);
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
                  
          <div className="space-y-2">
            <Label>{t("crm.endDate")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventEndDate ? format(eventEndDate, 'PPP HH:mm') : <span>{t("crm.pickDate")}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={eventEndDate}
                  onSelect={(date) => date && setEventEndDate(date)}
                  initialFocus
                />
                <div className="p-3 border-t border-border">
                  <Input
                    type="time"
                    value={format(eventEndDate, 'HH:mm')}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(eventEndDate);
                      newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                      setEventEndDate(newDate);
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="paymentStatus">{t("crm.paymentStatus")}</Label>
        <Select 
          value={paymentStatus} 
          onValueChange={setPaymentStatus}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("crm.selectPaymentStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
            <SelectItem value="partially_paid">{t("crm.partiallyPaid")}</SelectItem>
            <SelectItem value="full_paid">{t("crm.fullyPaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="paymentAmount">{t("crm.paymentAmount")}</Label>
        <Input
          id="paymentAmount"
          type="number"
          min="0"
          step="0.01"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          placeholder={t("crm.paymentAmount")}
        />
      </div>

      <div>
        <Label htmlFor="customerNotes">{t("crm.customerNotes")}</Label>
        <Textarea
          id="customerNotes"
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          placeholder={t("crm.customerNotes")}
          rows={4}
        />
      </div>

      <div>
        <Label>{t("crm.attachments")}</Label>
        {displayedFiles && displayedFiles.length > 0 && (
          <div className="mb-4">
            <FileDisplay 
              files={displayedFiles} 
              bucketName={bucketName}
              allowDelete={true}
              onFileDeleted={onFileDeleted}
              parentId={customerId || undefined}
              parentType={isEventBased ? 'event' : 'customer'}
            />
          </div>
        )}
        <FileUploadField
          selectedFile={selectedFile}
          onFileChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          acceptedFileTypes="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      </div>
    </>
  );
};
