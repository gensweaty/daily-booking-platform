
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Download, Trash2, FileIcon, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileDisplayProps {
  files: any[];
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentId?: string;
  parentType?: string;
}

export const FileDisplay = ({ 
  files, 
  bucketName, 
  allowDelete = false, 
  onFileDeleted,
  parentId,
  parentType
}: FileDisplayProps) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };
  
  const isImage = (filename: string): boolean => {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  const getFileIcon = (filename: string) => {
    return <FileIcon className="h-5 w-5" />;
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      console.log(`Attempting to download file from ${bucketName}/${filePath}`);
      
      // First try to get the public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        // Create a temporary link element to trigger download
        const a = document.createElement('a');
        a.href = publicUrlData.publicUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast({
          title: t("common.success"),
          description: t("common.downloadStarted"),
        });
        return;
      }
      
      // If public URL doesn't work, try creating a signed URL
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60); // 60 seconds expiry
      
      if (signedUrlError) {
        console.error('Error creating signed URL:', signedUrlError);
        
        // Try direct download as last resort
        const { data, error } = await supabase.storage
          .from(bucketName)
          .download(filePath);
          
        if (error) {
          console.error('Error downloading file:', error);
          toast({
            title: t("common.error"),
            description: error.message || t("common.downloadError"),
            variant: "destructive",
          });
          return;
        }
        
        if (!data) {
          console.error('No data returned from download');
          toast({
            title: t("common.error"),
            description: t("common.downloadError"),
            variant: "destructive",
          });
          return;
        }
        
        // Create a URL for the blob and trigger download
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Use the signed URL to download the file
        console.log('Using signed URL to download:', signedUrlData.signedUrl);
        
        // Create an anchor and trigger the download
        const a = document.createElement('a');
        a.href = signedUrlData.signedUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      toast({
        title: t("common.success"),
        description: t("common.downloadStarted"),
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleOpenFile = (filePath: string) => {
    try {
      // First try to get the public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      if (publicUrlData?.publicUrl) {
        window.open(publicUrlData.publicUrl, '_blank');
        return;
      }
      
      // If public URL doesn't work, try creating a signed URL
      supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 60)
        .then(({ data, error }) => {
          if (error) {
            throw error;
          }
          
          if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
          } else {
            throw new Error('Could not generate signed URL');
          }
        })
        .catch((error) => {
          console.error('Error opening file:', error);
          toast({
            title: t("common.error"),
            description: t("common.downloadError"),
            variant: "destructive",
          });
        });
    } catch (error) {
      console.error('Error opening file:', error);
      toast({
        title: t("common.error"),
        description: t("common.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    try {
      setDeletingFileId(fileId);
      
      // First delete the file from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        throw storageError;
      }
      
      // Then delete the database record
      let tableName = 'files';
      if (bucketName === 'event_attachments' || bucketName === 'booking_attachments') {
        tableName = 'event_files';
      } else if (bucketName === 'customer_attachments') {
        tableName = 'customer_files_new';
      } else if (bucketName === 'note_attachments') {
        tableName = 'note_files';
      }
      
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', fileId);
        
      if (dbError) {
        console.error(`Error deleting file from ${tableName}:`, dbError);
        throw dbError;
      }
      
      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
      queryClient.invalidateQueries({ queryKey: ['noteFiles'] });
      queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
      queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
      
      toast({
        title: t("common.success"),
        description: t("common.fileDeleted"),
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: t("common.error"),
        description: t("common.deleteError"),
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t("common.attachments")}</h3>
      <div className="space-y-2">
        {files.map((file) => {
          // Create the public URL for display/preview
          const { data } = supabase.storage
            .from(bucketName)
            .getPublicUrl(file.file_path);
            
          const publicUrl = data?.publicUrl;
          const fileNameDisplay = file.filename && file.filename.length > 20 
            ? file.filename.substring(0, 20) + '...' 
            : file.filename;
            
          return (
            <div key={file.id} className="flex flex-col bg-background border rounded-md overflow-hidden">
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  {isImage(file.filename) ? (
                    <div className="h-8 w-8 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      {publicUrl ? (
                        <img 
                          src={publicUrl} 
                          alt={file.filename}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            console.error('Image failed to load', e);
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      ) : (
                        <FileIcon className="h-5 w-5" />
                      )}
                    </div>
                  ) : (
                    <div className="h-8 w-8 bg-gray-100 rounded flex items-center justify-center">
                      {getFileIcon(file.filename)}
                    </div>
                  )}
                  <span className="truncate text-sm">{fileNameDisplay}</span>
                </div>
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(file.file_path, file.filename)}
                    title={t("common.download")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {allowDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(file.id, file.file_path)}
                      disabled={deletingFileId === file.id}
                      title={t("common.delete")}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Open button that matches the design */}
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-none border-t flex items-center justify-center gap-2 py-1.5"
                onClick={() => handleOpenFile(file.file_path)}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
