
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FileRecord {
  id: string;
  filename: string;
  file_path: string;
  content_type?: string;
  size?: number;
  created_at: string;
}

export const useLazyFileLoader = () => {
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [loadedFiles, setLoadedFiles] = useState<Map<string, FileRecord[]>>(new Map());

  const loadFilesForEntity = useCallback(async (entityId: string, entityType: 'customer' | 'event') => {
    if (loadedFiles.has(entityId) || loadingFiles.has(entityId)) {
      return loadedFiles.get(entityId) || [];
    }

    setLoadingFiles(prev => new Set(prev).add(entityId));

    try {
      let data: FileRecord[] = [];

      if (entityType === 'customer') {
        const { data: files, error } = await supabase
          .from('customer_files_new')
          .select('id, filename, file_path, content_type, size, created_at')
          .eq('customer_id', entityId)
          .limit(20); // Reasonable limit

        if (error) throw error;
        data = files || [];
      } else {
        const { data: files, error } = await supabase
          .from('event_files')
          .select('id, filename, file_path, content_type, size, created_at')
          .eq('event_id', entityId)
          .limit(20);

        if (error) throw error;
        data = files || [];
      }

      setLoadedFiles(prev => new Map(prev).set(entityId, data));
      return data;
    } catch (error) {
      console.error(`Error loading files for ${entityType} ${entityId}:`, error);
      return [];
    } finally {
      setLoadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(entityId);
        return newSet;
      });
    }
  }, [loadedFiles, loadingFiles]);

  const getFilesForEntity = useCallback((entityId: string) => {
    return loadedFiles.get(entityId) || [];
  }, [loadedFiles]);

  const isLoadingFiles = useCallback((entityId: string) => {
    return loadingFiles.has(entityId);
  }, [loadingFiles]);

  return {
    loadFilesForEntity,
    getFilesForEntity,
    isLoadingFiles
  };
};
