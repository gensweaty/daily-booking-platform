
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { downloadFile, openFile } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { getFileUrl } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface FileDisplayProps {
  files: Array<any>;
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
  parentType?: 'event' | 'customer' | 'task' | 'note';
  fallbackBuckets?: string[]; // Added the fallbackBuckets property
}

export const FileDisplay = ({
  files,
  bucketName,
  allowDelete = false,
  onFileDeleted,
  parentId,
  parentType,
  fallbackBuckets = [], // Added with default empty array
}: FileDisplayProps) => {
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<any | null>(null);

  const handleOpenFile = async (file: any) => {
    setLoadingFileId(file.id);
    try {
      const result = await openFile(bucketName, file.file_path);
      if (!result.success) {
        toast({
          title: t("common.error"),
          description: result.message || t("common.errorOccurred"),
          variant: "destructive",
        });
      }
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleDownloadFile = async (file: any) => {
    setLoadingFileId(file.id);
    try {
      const result = await downloadFile(bucketName, file.file_path, file.filename);
      if (!result.success) {
        toast({
          title: t("common.error"),
          description: result.message || t("common.errorOccurred"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("common.success"),
          description: t("common.downloadStarted"),
        });
      }
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleDeleteFile = (file: any) => {
    setFileToDelete(file);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete || !parentId || !parentType) return;

    try {
      setLoadingFileId(fileToDelete.id);

      // Delete the file record from the database
      const { error: deleteError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileToDelete.id);

      if (deleteError) {
        console.error("Error deleting file record:", deleteError);
        throw deleteError;
      }

      // Optionally, delete the file from storage (if needed)
      // const { error: storageError } = await supabase
      //   .storage
      //   .from(bucketName)
      //   .remove([fileToDelete.file_path]);

      // if (storageError) {
      //   console.error("Error deleting file from storage:", storageError);
      //   // Consider whether to throw an error or just log it
      // }

      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });

      onFileDeleted?.(fileToDelete.id);
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.errorOccurred"),
        variant: "destructive",
      });
    } finally {
      setLoadingFileId(null);
      setDeleteConfirmOpen(false);
      setFileToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  };

  const deduplicateFiles = (files: Array<any>) => {
    const uniqueFiles: Array<any> = [];
    const signatures = new Set<string>();
    
    files.forEach(file => {
      // Create a more robust signature that includes id, filename and path
      const signature = `${file.id || ''}:${file.filename || ''}:${file.file_path || ''}`;
      
      // Only add files with unique signatures
      if (!signatures.has(signature)) {
        signatures.add(signature);
        uniqueFiles.push(file);
      } else {
        console.log(`Duplicate file detected and skipped: ${file.filename}`);
      }
    });
    
    return uniqueFiles;
  };

  const filesToRender = deduplicateFiles(files);

  return (
    <>
      <div className="flex flex-col gap-2">
        {filesToRender.map((file) => (
          <div key={file.id} className="flex items-center justify-between rounded-md border p-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <a
                href={getFileUrl(bucketName, file.file_path)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("truncate hover:underline", isGeorgian ? "font-georgian" : "")}
              >
                {file.filename}
              </a>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenFile(file)}
                disabled={loadingFileId === file.id}
              >
                {loadingFileId === file.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDownloadFile(file)}
                disabled={loadingFileId === file.id}
              >
                {loadingFileId === file.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </Button>
              {allowDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeleteFile(file)}
                  disabled={loadingFileId === file.id}
                >
                  {loadingFileId === file.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.deleteFile")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteFileConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFile} disabled={loadingFileId === fileToDelete?.id}>
              {loadingFileId === fileToDelete?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("common.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
