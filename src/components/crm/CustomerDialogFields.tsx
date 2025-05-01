
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
}: CustomerDialogFieldsProps) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isGeorgian = language === 'ka';
  
  const labelClass = cn("block font-medium", isGeorgian ? "font-georgian" : "");
  
  return (
    <>
      <div>
        <Label htmlFor="fullName" className={labelClass}>
          <LanguageText>{t("crm.fullName")}</LanguageText>
        </Label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t("crm.fullName")}
        />
      </div>
      
      <div>
        <Label htmlFor="phoneNumber" className={labelClass}>
          <LanguageText>{t("crm.phoneNumber")}</LanguageText>
        </Label>
        <Input
          id="phoneNumber"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
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
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
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
