
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileIcon, Loader2, Download, Trash, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { FileRecord } from "@/types/files";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "./LanguageText";

interface FileDisplayProps {
  files: FileRecord[];
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentType?: 'event' | 'customer' | 'note' | 'task';
  parentId?: string;
}

export function FileDisplay({ 
  files, 
  bucketName, 
  allowDelete = false, 
  onFileDeleted, 
  parentType = 'event', 
  parentId 
}: FileDisplayProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { t } = useLanguage();
  
  useEffect(() => {
    const loadFileUrls = async () => {
      const urls: Record<string, string> = {};
      
      if (!files || files.length === 0) return;
      
      console.log(`Loading URLs for ${files.length} files from ${bucketName} bucket`);
      
      for (const file of files) {
        try {
          if (!file.file_path) {
            console.warn("File is missing file_path:", file);
            continue;
          }
          
          const { data, error } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(file.file_path, 3600); // 1 hour expiry
            
          if (error) {
            console.error(`Error creating signed URL for ${file.filename}:`, error);
            continue;
          }
          
          urls[file.id] = data.signedUrl;
          console.log(`Got signed URL for ${file.filename}`);
        } catch (err) {
          console.error(`Error processing file ${file.filename}:`, err);
        }
      }
      
      setFileUrls(urls);
    };

    loadFileUrls();
  }, [files, bucketName]);

  const isImageFile = (contentType: string | null): boolean => {
    if (!contentType) return false;
    return contentType.startsWith('image/');
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      setLoading(prev => ({ ...prev, [file.id]: true }));
      
      // If we already have a signed URL, use it directly
      if (fileUrls[file.id]) {
        window.open(fileUrls[file.id], '_blank');
        setLoading(prev => ({ ...prev, [file.id]: false }));
        return;
      }
      
      // Otherwise, get a new signed URL
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(file.file_path, 60);
        
      if (error) {
        throw error;
      }
      
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t("common.error"),
        description: t("fileDisplay.downloadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [file.id]: false }));
    }
  };

  const handleDelete = async (file: FileRecord) => {
    try {
      setLoading(prev => ({ ...prev, [file.id]: true }));
      
      // Delete the database record first
      const { error: dbError } = await supabase
        .from(parentType === 'event' ? 'event_files' : 
              parentType === 'customer' ? 'customer_files_new' : 
              parentType === 'note' ? 'note_files' : 
              'files')
        .delete()
        .eq('id', file.id);
      
      if (dbError) {
        throw dbError;
      }
      
      // We're not deleting the actual file from storage to prevent issues with 
      // files that might be referenced by multiple records
      
      toast({
        title: t("common.success"),
        description: t("fileDisplay.fileDeleted"),
      });
      
      if (onFileDeleted) {
        onFileDeleted(file.id);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: t("common.error"),
        description: t("fileDisplay.deleteError"),
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [file.id]: false }));
    }
  };

  if (files.length === 0) {
    return <div className="text-sm text-muted-foreground">
      <LanguageText>{t("fileDisplay.noFiles")}</LanguageText>
    </div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium mb-2">
        <LanguageText>{t("fileDisplay.attachedFiles")}</LanguageText> ({files.length})
      </div>
      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between p-2 border rounded-md bg-background">
            <div className="flex items-center space-x-2 overflow-hidden">
              {isImageFile(file.content_type) && fileUrls[file.id] ? (
                <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0">
                  <img 
                    src={fileUrls[file.id]} 
                    alt={file.filename} 
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-10 w-10 flex items-center justify-center bg-gray-100 rounded">
                  {isImageFile(file.content_type) ? (
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  ) : (
                    <FileIcon className="h-6 w-6 text-gray-400" />
                  )}
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm truncate font-medium" title={file.filename}>
                  {file.filename}
                </span>
                <div className="flex items-center space-x-1">
                  {file.content_type && (
                    <span className="text-xs text-muted-foreground">
                      {file.content_type.split('/')[1]?.toUpperCase()}
                    </span>
                  )}
                  {file.size && (
                    <span className="text-xs text-muted-foreground">
                      • {(file.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={() => handleDownload(file)}
                disabled={loading[file.id]}
                title={t("fileDisplay.download")}
                className="h-8 w-8"
              >
                {loading[file.id] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              
              {allowDelete && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDelete(file)}
                  disabled={loading[file.id]}
                  title={t("fileDisplay.delete")}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  {loading[file.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
