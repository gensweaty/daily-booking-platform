import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FileRecord } from '@/types/files';
import { Button } from '@/components/ui/button';
import { Trash2, FileText, File, Image, Download, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileTypeIcon } from './FileTypeIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from './LanguageText';

export interface FileDisplayProps {
  files: FileRecord[];
  bucketName: string;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
  parentType: 'event' | 'customer' | 'note' | 'task';
  parentId?: string;
}

export const FileDisplay = ({ 
  files, 
  bucketName, 
  allowDelete = false, 
  onFileDeleted,
  parentType
}: FileDisplayProps) => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const { t } = useLanguage();
  
  const getIconForFileType = (contentType: string | null) => {
    if (!contentType) return <File className="h-6 w-6 text-blue-500" />;
    
    if (contentType.startsWith('image/')) {
      return <Image className="h-6 w-6 text-green-500" />;
    } else if (
      contentType === 'application/pdf' ||
      contentType.includes('document') ||
      contentType.includes('sheet') ||
      contentType.includes('presentation')
    ) {
      return <FileText className="h-6 w-6 text-amber-500" />;
    }
    
    return <File className="h-6 w-6 text-blue-500" />;
  };

  const handleDownload = async (file: FileRecord) => {
    try {
      setLoading(prev => ({ ...prev, [file.id]: true }));
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(file.file_path);
        
      if (error) {
        console.error('Error downloading file:', error);
        return;
      }
      
      // Create a download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error handling download:', error);
    } finally {
      setLoading(prev => ({ ...prev, [file.id]: false }));
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      setLoading(prev => ({ ...prev, [fileId]: true }));
      
      const fileToDelete = files.find(file => file.id === fileId);
      if (!fileToDelete) return;
      
      const tableName = parentType === 'event' ? 'event_files' : 
                        parentType === 'customer' ? 'customer_files_new' : 
                        parentType === 'note' ? 'note_files' : 'files';
      
      // Delete file record from database
      const { error: dbError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', fileId);
        
      if (dbError) {
        console.error(`Error deleting file record from ${tableName}:`, dbError);
        return;
      }
      
      // Only try to delete storage file if we have the path
      if (fileToDelete.file_path) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove([fileToDelete.file_path]);
          
        if (storageError) {
          console.warn('Could not delete file from storage:', storageError);
          // Continue even if storage deletion fails
        }
      }
      
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Error handling file deletion:', error);
    } finally {
      setLoading(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const handleViewImage = async (file: FileRecord) => {
    try {
      if (file.content_type?.startsWith('image/')) {
        // Get a URL for the image
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(file.file_path);
          
        setViewImageUrl(publicUrl);
      }
    } catch (error) {
      console.error('Error handling image view:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    } else {
      return `${(kb / 1024).toFixed(1)} MB`;
    }
  };

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {files.map(file => (
          <li key={file.id} className="border rounded-lg overflow-hidden">
            <div className="flex items-center p-3 bg-background">
              <div className="flex-shrink-0 mr-3">
                {file.content_type?.startsWith('image/') ? (
                  <div 
                    className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => handleViewImage(file)}
                  >
                    <img 
                      src={supabase.storage.from(bucketName).getPublicUrl(file.file_path).data.publicUrl}
                      alt={file.filename}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to icon on image load error
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.appendChild(
                          document.createElement('div')
                        ).innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <FileTypeIcon contentType={file.content_type || ''} />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={file.filename}>
                  {file.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size || 0)}
                </p>
              </div>
              
              <div className="flex-shrink-0 ml-2 space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(file)}
                  disabled={loading[file.id]}
                  className="h-8 w-8"
                  title={t("common.download")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                
                {allowDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDeleteId(file.id)}
                    disabled={loading[file.id]}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                
                {file.content_type?.startsWith('image/') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewImage(file)}
                    className="h-8 w-8"
                    title={t("common.view")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><LanguageText>{t("common.confirmDelete")}</LanguageText></DialogTitle>
            <DialogDescription>
              <LanguageText>{t("common.deleteFileConfirmation")}</LanguageText>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              <LanguageText>{t("common.cancel")}</LanguageText>
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={loading[confirmDeleteId || '']}
            >
              <LanguageText>{t("common.delete")}</LanguageText>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewImageUrl} onOpenChange={(open) => !open && setViewImageUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle><LanguageText>{t("common.previewImage")}</LanguageText></DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[70vh] flex items-center justify-center">
            {viewImageUrl && <img src={viewImageUrl} alt="Preview" className="max-w-full" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
