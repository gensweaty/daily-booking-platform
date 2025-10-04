
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
    console.log(`🔍 Loading files for ${entityType} ${entityId}`);
    
    if (loadedFiles.has(entityId) || loadingFiles.has(entityId)) {
      console.log(`📋 Files already loaded/loading for ${entityType} ${entityId}`);
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
        console.log(`✅ Loaded ${data.length} customer files for ${entityId}`);
      } else {
        const { data: files, error } = await supabase
          .from('event_files')
          .select('id, filename, file_path, content_type, size, created_at')
          .eq('event_id', entityId)
          .limit(20);

        if (error) throw error;
        data = files || [];
        console.log(`✅ Loaded ${data.length} event files for ${entityId}`);
      }

      setLoadedFiles(prev => new Map(prev).set(entityId, data));
      return data;
    } catch (error) {
      console.error(`❌ Error loading files for ${entityType} ${entityId}:`, error);
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

  // Add method to refresh files for an entity (clear cache and reload)
  const refreshFilesForEntity = useCallback(async (entityId: string, entityType: 'customer' | 'event') => {
    console.log(`🔄 Refreshing files for ${entityType} ${entityId}`);
    
    // Clear cache for this entity
    setLoadedFiles(prev => {
      const newMap = new Map(prev);
      newMap.delete(entityId);
      return newMap;
    });
    
    // Load fresh data
    return await loadFilesForEntity(entityId, entityType);
  }, [loadFilesForEntity]);

  // Add method to update files cache after upload
  const addFileToCache = useCallback((entityId: string, newFile: FileRecord) => {
    console.log(`➕ Adding file to cache for entity ${entityId}:`, newFile.filename);
    setLoadedFiles(prev => {
      const newMap = new Map(prev);
      const existingFiles = newMap.get(entityId) || [];
      newMap.set(entityId, [...existingFiles, newFile]);
      return newMap;
    });
  }, []);

  return {
    loadFilesForEntity,
    getFilesForEntity,
    isLoadingFiles,
    refreshFilesForEntity,
    addFileToCache
  };
};
