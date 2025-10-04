import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to manage file refresh across CRM components
 * Ensures that file uploads in dialogs refresh the main CRM list
 */
export const useCRMFileRefresh = () => {
  const queryClient = useQueryClient();

  const refreshCRMData = useCallback(async (isPublicMode?: boolean) => {
    console.log(`🔄 [${isPublicMode ? 'Public' : 'Internal'}] Refreshing all CRM data after file operation`);
    
    try {
      // Invalidate all CRM-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['optimized-customers'] }),
        queryClient.invalidateQueries({ queryKey: ['customerFiles'] }),
        queryClient.invalidateQueries({ queryKey: ['eventFiles'] }),
      ]);

      // Force refetch of critical queries
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customers'] }),
        queryClient.refetchQueries({ queryKey: ['optimized-customers'] }),
      ]);

      console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] CRM data refresh completed`);
    } catch (error) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error refreshing CRM data:`, error);
    }
  }, [queryClient]);

  const refreshFilesForCustomer = useCallback(async (customerId: string, isPublicMode?: boolean) => {
    console.log(`🔄 [${isPublicMode ? 'Public' : 'Internal'}] Refreshing files for customer:`, customerId);
    
    try {
      // Invalidate specific customer file queries
      await queryClient.invalidateQueries({ 
        queryKey: ['customerFiles', customerId] 
      });
      
      // Also refresh the broader CRM data to ensure consistency
      await refreshCRMData(isPublicMode);
      
      console.log(`✅ [${isPublicMode ? 'Public' : 'Internal'}] Files refreshed for customer:`, customerId);
    } catch (error) {
      console.error(`❌ [${isPublicMode ? 'Public' : 'Internal'}] Error refreshing files for customer:`, customerId, error);
    }
  }, [queryClient, refreshCRMData]);

  return {
    refreshCRMData,
    refreshFilesForCustomer,
  };
};