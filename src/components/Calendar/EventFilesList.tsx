
import React from "react";
import { FileDisplay } from "@/components/shared/FileDisplay";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FileRecord } from "@/types/files";

interface EventFilesListProps {
  files: FileRecord[];
  onDelete?: (fileId: string) => void;
}

export const EventFilesList: React.FC<EventFilesListProps> = ({ 
  files,
  onDelete
}) => {
  const { t } = useLanguage();
  
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t("common.attachments")}</h3>
      <FileDisplay 
        files={files}
        bucketName="event_attachments"
        allowDelete={!!onDelete}
        onFileDeleted={onDelete}
        parentType="event"
      />
    </div>
  );
};
