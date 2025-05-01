
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { FileRecord } from "@/types/files";
import { cn } from "@/lib/utils";
import { LanguageText } from "@/components/shared/LanguageText";
import { useTheme } from "next-themes";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface CustomerDialogFieldsProps {
  fullName?: string;
  setFullName?: (value: string) => void;
  phoneNumber?: string;
  setPhoneNumber?: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  customerNotes?: string;
  setCustomerNotes?: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  customerId?: string;
  displayedFiles?: FileRecord[];
  onFileDeleted?: (fileId: string) => void;
  // Added these properties to make it compatible with CustomerDialog
  title?: string;
  setTitle?: (value: any) => void;
  userSurname?: string;
  setUserSurname?: (value: any) => void;
  userNumber?: string;
  setUserNumber?: (value: string) => void;
  eventNotes?: string; 
  setEventNotes?: (value: string) => void;
  createEvent?: boolean;
  setCreateEvent?: (value: boolean) => void;
  paymentStatus?: string;
  setPaymentStatus?: (value: string) => void;
  paymentAmount?: string;
  setPaymentAmount?: (value: string) => void;
  isEventBased?: boolean;
  startDate?: string;
  endDate?: string;
  eventStartDate?: Date;
  setEventStartDate?: (date: Date) => void;
  eventEndDate?: Date;
  setEventEndDate?: (date: Date) => void;
}

export const CustomerDialogFields = ({
  fullName,
  setFullName,
  phoneNumber,
  setPhoneNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  customerNotes,
  setCustomerNotes,
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  customerId,
  displayedFiles = [],
  onFileDeleted = () => {},
  // Use new props if provided, otherwise fall back to original ones
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  eventNotes,
  setEventNotes,
  createEvent,
  setCreateEvent,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  isEventBased,
  startDate,
  endDate,
  eventStartDate,
  setEventStartDate,
  eventEndDate,
  setEventEndDate
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isGeorgian = language === 'ka';
  
  const labelClass = cn("block font-medium", isGeorgian ? "font-georgian" : "");
  
  // Handle the name field based on which props are provided
  const effectiveFullName = userSurname !== undefined ? userSurname : fullName;
  const setEffectiveFullName = (value: string) => {
    if (setUserSurname) {
      setUserSurname(value);
      if (setTitle) setTitle(value);
    } else if (setFullName) {
      setFullName(value);
    }
  };

  // Handle the phone field based on which props are provided
  const effectivePhoneNumber = userNumber !== undefined ? userNumber : phoneNumber;
  const setEffectivePhoneNumber = (value: string) => {
    if (setUserNumber) {
      setUserNumber(value);
    } else if (setPhoneNumber) {
      setPhoneNumber(value);
    }
  };

  // Handle the notes field based on which props are provided
  const effectiveNotes = eventNotes !== undefined ? eventNotes : customerNotes;
  const setEffectiveNotes = (value: string) => {
    if (setEventNotes) {
      setEventNotes(value);
    } else if (setCustomerNotes) {
      setCustomerNotes(value);
    }
  };
  
  return (
    <>
      <div>
        <Label htmlFor="fullName" className={labelClass}>
          <LanguageText>{t("crm.fullName")}</LanguageText>
        </Label>
        <Input
          id="fullName"
          value={effectiveFullName}
          onChange={(e) => setEffectiveFullName(e.target.value)}
          placeholder={t("crm.fullName")}
        />
      </div>
      
      <div>
        <Label htmlFor="phoneNumber" className={labelClass}>
          <LanguageText>{t("crm.phoneNumber")}</LanguageText>
        </Label>
        <Input
          id="phoneNumber"
          value={effectivePhoneNumber}
          onChange={(e) => setEffectivePhoneNumber(e.target.value)}
          placeholder={t("crm.phoneNumber")}
        />
      </div>
      
      <div>
        <Label htmlFor="socialNetworkLink" className={labelClass}>
          <LanguageText>{t("crm.socialLinkEmail")}</LanguageText>
        </Label>
        <Input
          id="socialNetworkLink"
          value={socialNetworkLink}
          onChange={(e) => setSocialNetworkLink(e.target.value)}
          placeholder="email@example.com"
          type="email"
        />
      </div>
      
      {/* Add createEvent field if props exist */}
      {setCreateEvent !== undefined && (
        <div className="flex items-center space-x-2 py-2">
          <Checkbox 
            id="createEvent" 
            checked={createEvent} 
            onCheckedChange={setCreateEvent}
          />
          <Label htmlFor="createEvent" className={cn(labelClass, "cursor-pointer")}>
            <LanguageText>{t("crm.createEvent")}</LanguageText>
          </Label>
        </div>
      )}
      
      {/* Add payment status field if props exist and createEvent is true */}
      {setPaymentStatus !== undefined && createEvent && (
        <div>
          <Label htmlFor="paymentStatus" className={labelClass}>
            <LanguageText>{t("crm.paymentStatus")}</LanguageText>
          </Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
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
      )}
      
      {/* Add payment amount field if props exist, createEvent is true, and payment status is not "not_paid" */}
      {setPaymentAmount !== undefined && createEvent && paymentStatus && paymentStatus !== 'not_paid' && (
        <div>
          <Label htmlFor="paymentAmount" className={labelClass}>
            <LanguageText>{t("crm.paymentAmount")}</LanguageText>
          </Label>
          <Input
            id="paymentAmount"
            type="number"
            min="0"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      )}
      
      {/* Add event date/time fields if props exist and createEvent is true */}
      {setEventStartDate && setEventEndDate && createEvent && (
        <div>
          <Label className={labelClass}>
            <LanguageText>{t("events.dateAndTime")}</LanguageText>
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="startDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                {t("events.start")}
              </Label>
              <div className="relative">
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={eventStartDate ? format(eventStartDate, "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => {
                    if (setEventStartDate) setEventStartDate(new Date(e.target.value));
                  }}
                  className="w-full"
                  style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="endDate" className={cn("text-xs text-muted-foreground", isGeorgian ? "font-georgian" : "")}>
                {t("events.end")}
              </Label>
              <div className="relative">
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={eventEndDate ? format(eventEndDate, "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => {
                    if (setEventEndDate) setEventEndDate(new Date(e.target.value));
                  }}
                  className="w-full"
                  style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div>
        <Label htmlFor="customerNotes" className={labelClass}>
          <LanguageText>{t("crm.customerNotes")}</LanguageText>
        </Label>
        <Textarea
          id="customerNotes"
          value={effectiveNotes}
          onChange={(e) => setEffectiveNotes(e.target.value)}
          placeholder={t("crm.addCustomerNotes")}
          className="min-h-[100px] resize-none"
        />
      </div>
      
      <div>
        <Label htmlFor="file" className={labelClass}>
          <LanguageText>{t("common.attachments")}</LanguageText>
        </Label>
        <FileUploadField
          onChange={setSelectedFile}
          fileError={fileError}
          setFileError={setFileError}
          acceptedFileTypes=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          selectedFile={selectedFile}
          hideLabel={true}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Supported formats: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT
        </p>
      </div>
      
      {displayedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <FileDisplay
            files={displayedFiles}
            bucketName="customer_attachments"
            allowDelete={true}
            onFileDeleted={onFileDeleted}
            parentType="customer"
          />
        </div>
      )}
    </>
  );
};
