
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

interface CustomerDialogFieldsProps {
  fullName: string;
  setFullName: (value: string) => void;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  customerNotes: string;
  setCustomerNotes: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  customerId?: string;
  displayedFiles: FileRecord[];
  onFileDeleted: (fileId: string) => void;
  // Added these properties to make it compatible with CustomerDialog
  title?: string;
  setTitle?: (value: any) => void;
  userSurname?: string;
  setUserSurname?: (value: any) => void;
  userNumber?: string;
  setUserNumber?: (value: string) => void;
  eventNotes?: string; 
  setEventNotes?: (value: string) => void;
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
  displayedFiles,
  onFileDeleted,
  // Use new props if provided, otherwise fall back to original ones
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  eventNotes,
  setEventNotes
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
    } else {
      setFullName(value);
    }
  };

  // Handle the phone field based on which props are provided
  const effectivePhoneNumber = userNumber !== undefined ? userNumber : phoneNumber;
  const setEffectivePhoneNumber = (value: string) => {
    if (setUserNumber) {
      setUserNumber(value);
    } else {
      setPhoneNumber(value);
    }
  };

  // Handle the notes field based on which props are provided
  const effectiveNotes = eventNotes !== undefined ? eventNotes : customerNotes;
  const setEffectiveNotes = (value: string) => {
    if (setEventNotes) {
      setEventNotes(value);
    } else {
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
          {language === 'en' && "Supported formats: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT"}
          {language === 'es' && "Formatos admitidos: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT"}
          {language === 'ka' && "მხარდაჭერილი ფორმატები: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, TXT"}
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
