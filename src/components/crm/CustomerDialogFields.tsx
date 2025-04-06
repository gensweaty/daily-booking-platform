
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "../shared/FileDisplay";

export interface CustomerDialogFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  userSurname: string;
  setUserSurname: (surname: string) => void;
  userNumber: string;
  setUserNumber: (number: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (link: string) => void;
  eventNotes: string;
  setEventNotes: (notes: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  paymentStatus: string;
  setPaymentStatus: (status: string) => void;
  paymentAmount: string;
  setPaymentAmount: (amount: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  customerId?: string;
  createEvent: boolean;
  setCreateEvent: (create: boolean) => void;
  isEventData: boolean;
  isOpen: boolean;
  customerFiles?: any[];
  onFileDeleted?: (fileId: string) => void;
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
  customerId,
  createEvent,
  setCreateEvent,
  isEventData,
  isOpen,
  customerFiles = [],
  onFileDeleted,
}: CustomerDialogFieldsProps) => {
  const { t } = useLanguage();
  
  // Function to handle formatted date inputs
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toISOString().slice(0, 16);
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">{t("crm.title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("crm.titlePlaceholder")}
        />
      </div>

      {/* Customer Name */}
      <div className="space-y-2">
        <Label htmlFor="userSurname">{t("crm.customerName")}</Label>
        <Input
          id="userSurname"
          value={userSurname}
          onChange={(e) => setUserSurname(e.target.value)}
          placeholder={t("crm.customerNamePlaceholder")}
          required
        />
      </div>

      {/* Phone Number */}
      <div className="space-y-2">
        <Label htmlFor="userNumber">{t("crm.phoneNumber")}</Label>
        <Input
          id="userNumber"
          value={userNumber}
          onChange={(e) => setUserNumber(e.target.value)}
          placeholder={t("crm.phoneNumberPlaceholder")}
        />
      </div>

      {/* Email or Social Network Link */}
      <div className="space-y-2">
        <Label htmlFor="socialNetworkLink">{t("crm.emailOrSocial")}</Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder={t("crm.emailOrSocialPlaceholder")}
        />
      </div>

      {/* Create Event Toggle */}
      <div className="flex items-center space-x-2">
        <Switch
          id="createEvent"
          checked={createEvent}
          onCheckedChange={setCreateEvent}
        />
        <Label htmlFor="createEvent">{t("crm.createEvent")}</Label>
      </div>

      {/* Conditional Event Fields */}
      {createEvent && (
        <div className="space-y-4 bg-muted/30 p-4 rounded-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("crm.startDate")}</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={formatDateForInput(startDate)}
                onChange={(e) => setStartDate(e.target.value)}
                required={createEvent}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t("crm.endDate")}</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={formatDateForInput(endDate)}
                onChange={(e) => setEndDate(e.target.value)}
                required={createEvent}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentStatus">{t("crm.paymentStatus")}</Label>
              <Select
                value={paymentStatus}
                onValueChange={setPaymentStatus}
              >
                <SelectTrigger id="paymentStatus">
                  <SelectValue placeholder={t("crm.selectPaymentStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_paid">{t("crm.notPaid")}</SelectItem>
                  <SelectItem value="partly">{t("crm.partlyPaid")}</SelectItem>
                  <SelectItem value="fully">{t("crm.fullyPaid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentStatus && paymentStatus !== "not_paid" && (
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">{t("crm.paymentAmount")}</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={t("crm.paymentAmountPlaceholder")}
                  required={paymentStatus !== "not_paid"}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="eventNotes">{t("crm.notes")}</Label>
        <Textarea
          id="eventNotes"
          value={eventNotes}
          onChange={(e) => setEventNotes(e.target.value)}
          placeholder={t("crm.notesPlaceholder")}
          rows={3}
        />
      </div>

      {/* Display existing files */}
      {customerFiles && customerFiles.length > 0 && (
        <Card className="p-4 mt-4">
          <Label className="mb-2 block">{t("crm.attachedFiles")}</Label>
          <FileDisplay
            files={customerFiles.map(file => ({
              id: file.file_path,
              filename: file.filename,
              content_type: file.content_type,
            }))}
            bucketName="customer_attachments"
            allowDelete={!!onFileDeleted}
            onFileDeleted={onFileDeleted}
          />
        </Card>
      )}

      {/* File Upload */}
      <div className="space-y-2">
        <Label htmlFor="file">{t("crm.attachFile")}</Label>
        <input
          type="file"
          id="file"
          className="block w-full text-sm text-slate-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-primary file:text-primary-foreground
            hover:file:bg-primary/90
            cursor-pointer"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              if (file.size > 10 * 1024 * 1024) {
                setFileError(t("crm.fileTooLarge"));
                return;
              }
              setSelectedFile(file);
              setFileError("");
            }
          }}
        />
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
      </div>
    </div>
  );
};
