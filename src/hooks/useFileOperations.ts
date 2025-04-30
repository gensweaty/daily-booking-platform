
import { useState } from 'react';
import { FileRecord } from '@/types/files';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { 
  uploadFile, 
  createFileRecord, 
  deleteFile,
  invalidateFileQueries
} from '@/services/fileService';
import { supabase } from '@/lib/supabase';

export function useFileOperations(entityType: 'event' | 'customer' | 'note' | 'task' = 'event') {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Map entity type to its respective table name
  const getTableName = (type: string) => {
    switch(type) {
      case 'event': return 'event_files';
      case 'customer': return 'customer_files_new';
      case 'note': return 'note_files';
      case 'task': return 'files';
      default: return 'event_files';
    }
  };

  // Map entity type to its ID field name
  const getIdFieldName = (type: string) => {
    switch(type) {
      case 'event': return 'event_id';
      case 'customer': return 'customer_id';
      case 'note': return 'note_id';
      case 'task': return 'task_id';
      default: return 'event_id';
    }
  };

  // Function to upload a file and associate it with an entity
  const handleFileUpload = async (file: File, entityId: string, userId: string) => {
    if (!file || !entityId || !userId) {
      setUploadError('Missing required parameters for file upload');
      return null;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    
    try {
      // Upload file to storage
      const uploadResult = await uploadFile(file, entityId, userId);
      
      if (!uploadResult) {
        throw new Error('File upload failed');
      }
      
      setUploadProgress(50);
      
      // Create database record for the file
      const fileData = {
        ...uploadResult,
        [entityType === 'event' ? 'event_id' : 
         entityType === 'customer' ? 'customer_id' :
         entityType === 'note' ? 'note_id' : 'task_id']: entityId
      };
      
      const record = await createFileRecord(fileData, entityType);
      
      if (!record) {
        throw new Error('Failed to create file record in database');
      }
      
      setUploadProgress(100);
      
      // Invalidate related queries
      invalidateFileQueries(queryClient);
      
      toast({
        title: 'Success',
        description: 'File uploaded successfully',
      });
      
      return record;
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadError(error instanceof Error ? error.message : 'Unknown error during file upload');
      
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
      
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Function to fetch files for an entity
  const fetchFiles = async (entityId: string) => {
    if (!entityId) return [];
    
    const tableName = getTableName(entityType);
    const idFieldName = getIdFieldName(entityType);
    
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(idFieldName, entityId);
        
      if (error) {
        console.error(`Error fetching ${entityType} files:`, error);
        return [];
      }
      
      console.log(`Fetched ${data?.length || 0} files for ${entityType} ${entityId}`);
      return data || [];
    } catch (error) {
      console.error(`Error in fetchFiles for ${entityType}:`, error);
      return [];
    }
  };

  // Function to delete a file
  const handleFileDelete = async (fileId: string, filePath: string) => {
    try {
      const success = await deleteFile(filePath, fileId, entityType);
      
      if (!success) {
        throw new Error('Failed to delete file');
      }
      
      // Invalidate related queries
      invalidateFileQueries(queryClient);
      
      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
      
      return false;
    }
  };

  return {
    handleFileUpload,
    fetchFiles,
    handleFileDelete,
    isUploading,
    uploadError,
    uploadProgress,
  };
}
