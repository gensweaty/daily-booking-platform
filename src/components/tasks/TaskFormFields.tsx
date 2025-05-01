
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { cn } from "@/lib/utils";
import { FileRecord } from "@/types/files";
import { LanguageText } from "@/components/shared/LanguageText";

interface TaskFormFieldsProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  fileError: string;
  setFileError: (error: string) => void;
  taskId?: string;
  displayedFiles: FileRecord[];
  onFileDeleted: (fileId: string) => void;
}

export const TaskFormFields = ({
  selectedFile,
  setSelectedFile,
  fileError,
  setFileError,
  taskId,
  displayedFiles,
  onFileDeleted,
}: TaskFormFieldsProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const labelClass = cn("block font-medium", isGeorgian ? "font-georgian" : "");
  
  return (
    <>
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
        <div className="flex flex-col gap-2 mt-2">
          <FileDisplay
            files={displayedFiles}
            bucketName="task_attachments"
            allowDelete={true}
            onFileDeleted={onFileDeleted}
            parentType="task"
          />
        </div>
      )}
    </>
  );
};
