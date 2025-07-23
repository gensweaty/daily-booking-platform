
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarEventType } from "@/lib/types/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface EventDialogFieldsProps {
  event: CalendarEventType;
  onFieldChange: (field: keyof CalendarEventType, value: any) => void;
}

export const EventDialogFields = ({ event, onFieldChange }: EventDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <div className="space-y-4">
      {/* Date & Time Section */}
      <div className="space-y-2">
        <Label className={isGeorgian ? "font-georgian" : ""}>
          {t("events.dateTime")}
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className={isGeorgian ? "font-georgian text-sm" : "text-sm"}>
              {t("events.start")}
            </Label>
            <Input
              type="datetime-local"
              value={event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : ""}
              onChange={(e) => onFieldChange("start_date", new Date(e.target.value).toISOString())}
            />
          </div>
          <div>
            <Label className={isGeorgian ? "font-georgian text-sm" : "text-sm"}>
              {t("events.end")}
            </Label>
            <Input
              type="datetime-local"
              value={event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : ""}
              onChange={(e) => onFieldChange("end_date", new Date(e.target.value).toISOString())}
            />
          </div>
        </div>
      </div>

      {/* Recurring Event Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="recurring"
          checked={event.is_recurring || false}
          onCheckedChange={(checked) => onFieldChange("is_recurring", checked)}
        />
        <Label htmlFor="recurring" className={isGeorgian ? "font-georgian" : ""}>
          {t("events.makeRecurring")}
        </Label>
      </div>

      {/* Person Data Section */}
      <div className="space-y-2">
        <Label className={isGeorgian ? "font-georgian" : ""}>
          {t("events.personData")}
        </Label>
        
        <div>
          <Label className={isGeorgian ? "font-georgian text-sm" : "text-sm"}>
            {t("events.fullName")}
          </Label>
          <Input
            value={event.user_surname || ""}
            onChange={(e) => onFieldChange("user_surname", e.target.value)}
            placeholder={t("events.fullName")}
          />
        </div>

        <div>
          <Label className={isGeorgian ? "font-georgian text-sm" : "text-sm"}>
            {t("events.phoneNumber")}
          </Label>
          <Input
            value={event.user_number || ""}
            onChange={(e) => onFieldChange("user_number", e.target.value)}
            placeholder={t("events.phoneNumber")}
          />
        </div>

        <div>
          <Label className={isGeorgian ? "font-georgian text-sm" : "text-sm"}>
            {t("events.email")}
          </Label>
          <Input
            type="email"
            value={event.social_network_link || ""}
            onChange={(e) => onFieldChange("social_network_link", e.target.value)}
            placeholder="email@example.com"
          />
        </div>
      </div>

      {/* Payment Status */}
      <div className="space-y-2">
        <Label className={isGeorgian ? "font-georgian" : ""}>
          {t("events.paymentStatus")}
        </Label>
        <Select
          value={event.payment_status || "not_paid"}
          onValueChange={(value) => onFieldChange("payment_status", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_paid">
              {isGeorgian ? <GeorgianAuthText>არ არის გადახდილი</GeorgianAuthText> : t("events.notPaid")}
            </SelectItem>
            <SelectItem value="paid">
              {isGeorgian ? <GeorgianAuthText>გადახდილი</GeorgianAuthText> : t("events.paid")}
            </SelectItem>
            <SelectItem value="partially_paid">
              {isGeorgian ? <GeorgianAuthText>ნაწილობრივ გადახდილი</GeorgianAuthText> : t("events.partiallyPaid")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className={isGeorgian ? "font-georgian" : ""}>
          {t("events.notes")}
        </Label>
        <Textarea
          value={event.event_notes || ""}
          onChange={(e) => onFieldChange("event_notes", e.target.value)}
          placeholder={t("events.notesPlaceholder")}
          className="min-h-20"
        />
      </div>

      {/* File Upload */}
      <div className="space-y-2">
        <Label className={isGeorgian ? "font-georgian" : ""}>
          {t("events.attachments")}
        </Label>
        <FileUploadField
          onFileSelect={(file) => onFieldChange("file", file)}
          accept="image/*,application/pdf,.doc,.docx"
          maxSize={5 * 1024 * 1024} // 5MB
        />
      </div>
    </div>
  );
};
