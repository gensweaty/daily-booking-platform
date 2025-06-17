
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/currency";
import { GroupMembersField, GroupMember } from "./GroupMembersField";

interface EventDialogFieldsProps {
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
  eventId?: string;
  onFileDeleted: (fileId: string) => void;
  displayedFiles: any[];
  isBookingRequest?: boolean;
  // Group booking props
  isGroupEvent: boolean;
  setIsGroupEvent: (isGroup: boolean) => void;
  groupName: string;
  setGroupName: (name: string) => void;
  groupMembers: GroupMember[];
  setGroupMembers: (members: GroupMember[]) => void;
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
  onFileDeleted,
  displayedFiles,
  isBookingRequest = false,
  // Group booking props
  isGroupEvent,
  setIsGroupEvent,
  groupName,
  setGroupName,
  groupMembers,
  setGroupMembers,
}: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const currencySymbol = getCurrencySymbol(language);

  const handleGroupEventChange = (checked: boolean) => {
    console.log("Group event toggle clicked:", checked);
    setIsGroupEvent(checked);
    
    // Clear individual fields when switching to group
    if (checked) {
      setUserSurname("");
      setUserNumber("");
      setSocialNetworkLink("");
      setEventNotes("");
      setPaymentStatus("not_paid");
      setPaymentAmount("");
    } else {
      // Clear group fields when switching to individual
      setGroupName("");
      setGroupMembers([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Group Event Toggle */}
      <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
        <Switch
          id="group-event-toggle"
          checked={isGroupEvent}
          onCheckedChange={handleGroupEventChange}
        />
        <Label 
          htmlFor="group-event-toggle" 
          className={cn("cursor-pointer font-medium", isGeorgian ? "font-georgian" : "")}
        >
          {t("events.groupEvent")}
        </Label>
      </div>

      {/* Group Name or Individual Name */}
      {isGroupEvent ? (
        <div>
          <Label htmlFor="group-name" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.groupName")} *
          </Label>
          <Input
            id="group-name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            placeholder={isGeorgian ? "ჯგუფის სახელი" : "Group name"}
            required
          />
        </div>
      ) : (
        <div>
          <Label htmlFor="full-name" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.fullName")} *
          </Label>
          <Input
            id="full-name"
            value={userSurname}
            onChange={(e) => {
              setUserSurname(e.target.value);
              setTitle(e.target.value);
            }}
            className={cn(isGeorgian ? "font-georgian" : "")}
            placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
            required
          />
        </div>
      )}

      {/* Date and Time Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start-date" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.startDate")} *
          </Label>
          <Input
            id="start-date"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="end-date" className={cn(isGeorgian ? "font-georgian" : "")}>
            {t("events.endDate")} *
          </Label>
          <Input
            id="end-date"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Individual Customer Fields - Only show for non-group events */}
      {!isGroupEvent && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone-number" className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.phoneNumber")}
              </Label>
              <Input
                id="phone-number"
                value={userNumber}
                onChange={(e) => setUserNumber(e.target.value)}
                className={cn(isGeorgian ? "font-georgian" : "")}
                placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
              />
            </div>

            <div>
              <Label htmlFor="email" className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.socialLinkEmail")}
              </Label>
              <Input
                id="email"
                type="email"
                value={socialNetworkLink}
                onChange={(e) => setSocialNetworkLink(e.target.value)}
                className={cn(isGeorgian ? "font-georgian" : "")}
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="payment-status" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.paymentStatus")}
            </Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_paid">{t("events.notPaid")}</SelectItem>
                <SelectItem value="partly_paid">{t("events.partlyPaid")}</SelectItem>
                <SelectItem value="fully_paid">{t("events.fullyPaid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(paymentStatus === "partly_paid" || paymentStatus === "fully_paid") && (
            <div>
              <Label htmlFor="payment-amount" className={cn(isGeorgian ? "font-georgian" : "")}>
                {t("events.paymentAmount")}
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="text-gray-500">{currencySymbol}</span>
                </div>
                <Input
                  id="payment-amount"
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      setPaymentAmount(value);
                    }
                  }}
                  className={cn("pl-7", isGeorgian ? "font-georgian" : "")}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="event-notes" className={cn(isGeorgian ? "font-georgian" : "")}>
              {t("events.eventNotes")}
            </Label>
            <Textarea
              id="event-notes"
              value={eventNotes}
              onChange={(e) => setEventNotes(e.target.value)}
              className={cn(isGeorgian ? "font-georgian" : "")}
              rows={3}
              placeholder={isGeorgian ? "დაამატეთ შენიშვნები" : "Add notes about this event"}
            />
          </div>
        </>
      )}

      {/* Group Members Field - Only show for group events */}
      {isGroupEvent && (
        <GroupMembersField
          groupMembers={groupMembers}
          setGroupMembers={setGroupMembers}
          eventId={eventId}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* File Upload */}
      <FileUploadField
        selectedFile={selectedFile}
        onFileChange={setSelectedFile}
        fileError={fileError}
        setFileError={setFileError}
        acceptedFileTypes=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
        maxSizeMB={10}
      />

      {/* Display Files */}
      {displayedFiles.length > 0 && (
        <FileDisplay
          files={displayedFiles}
          onFileDeleted={onFileDeleted}
          bucketName="event_attachments"
        />
      )}
    </div>
  );
};
