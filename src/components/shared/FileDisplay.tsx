import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileIcon, 
  ImageIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  PresentationIcon,
  FileArchiveIcon,
  FileBarChartIcon,
  FileDigitIcon,
  FileCode2Icon,
  FileTypeIcon,
  Trash2Icon,
  DownloadIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from './LanguageText';
import { FileRecord } from '@/types/files';

interface FileDisplayProps {
  files: FileRecord[];
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentType?: 'event' | 'customer' | 'booking' | 'task' | 'note';
  parentId?: string;
}

const BUCKET_NAME = 'event_attachments';

export const FileDisplay = ({
  files,
  bucketName = BUCKET_NAME,
  allowDelete = false,
  onFileDeleted,
  parentType = 'event',
  parentId
}: FileDisplayProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);

  const getFileIcon = (contentType: string | null, fileName: string) => {
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    
    if (contentType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt || '')) {
      return <ImageIcon className="h-5 w-5" />;
    }
    
    if (contentType?.includes('pdf') || fileExt === 'pdf') {
      return <FileTextIcon className="h-5 w-5" />;
    }
    
    if (['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
      return <FileSpreadsheetIcon className="h-5 w-5" />;
    }
    
    if (['ppt', 'pptx'].includes(fileExt || '')) {
      return <PresentationIcon className="h-5 w-5" />;
    }
    
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt || '')) {
      return <FileArchiveIcon className="h-5 w-5" />;
    }
    
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'php', 'py', 'java', 'c', 'cpp'].includes(fileExt || '')) {
      return <FileCode2Icon className="h-5 w-5" />;
    }
    
    if (['txt', 'md', 'rtf'].includes(fileExt || '')) {
      return <FileTextIcon className="h-5 w-5" />;
    }
    
    if (['json', 'xml'].includes(fileExt || '')) {
      return <FileDigitIcon className="h-5 w-5" />;
    }
    
    return <FileIcon className="h-5 w-5" />;
  };

  const truncateFileName = (name: string, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    
    const extension = name.split('.').pop();
    const nameWithoutExtension = name.substring(0, name.lastIndexOf('.'));
    
    if (nameWithoutExtension.length <= maxLength - 4) {
      return name;
    }
    
    return `${nameWithoutExtension.substring(0, maxLength - 4)}...${extension ? `.${extension}` : ''}`;
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined) return '';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(2);
    
    return `${size} ${sizes[i]}`;
  };

  const openFile = async (file: FileRecord) => {
    try {
      console.log(`Attempting to get signed URL for file: ${file.filename} in bucket: ${bucketName}, path: ${file.file_path}`);
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(file.file_path, 60);
  
      if (error) {
        console.error('Error getting signed URL:', error);
        throw error;
      }
  
      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }
  
      console.log('Received signed URL:', data.signedUrl);
  
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error opening file:', error);
      toast({
        title: t("common.error"),
        description: `${t("common.errorOpeningFile")}: ${file.filename}`,
        variant: "destructive",
      });
    }
  };

  const downloadFile = async (file: FileRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(file.file_path);
  
      if (error) {
        console.error('Error downloading file:', error);
        throw error;
      }
  
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t("common.error"),
        description: `${t("common.errorDownloadingFile")}: ${file.filename}`,
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!fileId || isDeleting) return;
    
    setIsDeleting(true);
    setCurrentFileId(fileId);

    try {
      const fileToDelete = files.find(file => file.id === fileId);
      if (!fileToDelete) {
        throw new Error('File not found');
      }
      
      console.log(`Deleting file: ${fileId}, path: ${fileToDelete.file_path} from bucket: ${bucketName}`);
      
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([fileToDelete.file_path]);
      
      if (storageError) {
        console.error('Error removing file from storage:', storageError);
      }

      let tableToDeleteFrom;
      if (parentType === 'customer') {
        tableToDeleteFrom = 'customer_files_new';
      } else if (parentType === 'booking') {
        tableToDeleteFrom = 'event_files';
      } else if (parentType === 'task') {
        tableToDeleteFrom = 'files';
      } else if (parentType === 'note') {
        tableToDeleteFrom = 'note_files';
      } else {
        tableToDeleteFrom = 'event_files';
      }
      
      const { error: dbError } = await supabase
        .from(tableToDeleteFrom)
        .delete()
        .eq('id', fileId);
      
      if (dbError) {
        console.error(`Error deleting file record from ${tableToDeleteFrom}:`, dbError);
        throw dbError;
      }
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
    } catch (error) {
      console.error('Error in delete process:', error);
      toast({
        title: t("common.error"),
        description: t("common.errorDeletingFile"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setCurrentFileId(null);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        <LanguageText>
          {files.length === 1 
            ? t("common.attachment") 
            : `${files.length} ${t("common.attachments")}`}
        </LanguageText>
      </h3>
      
      <div className="grid grid-cols-1 gap-2">
        {files.map((file) => (
          <Card key={file.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="bg-muted rounded-md p-2 flex-shrink-0">
                    {getFileIcon(file.content_type, file.filename)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" title={file.filename}>
                      {truncateFileName(file.filename)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => downloadFile(file)}
                    title={t("common.download")}
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => openFile(file)}
                    title={t("crm.open")}
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </Button>
                  
                  {allowDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title={t("common.delete")}
                          className="text-destructive hover:text-destructive"
                          disabled={isDeleting && currentFileId === file.id}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            <LanguageText>{t("common.confirmDeletion")}</LanguageText>
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <LanguageText>
                              {t("common.confirmFileDeleteDescription")}
                            </LanguageText>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            <LanguageText>{t("common.cancel")}</LanguageText>
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteFile(file.id)}
                          >
                            <LanguageText>{t("common.delete")}</LanguageText>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
