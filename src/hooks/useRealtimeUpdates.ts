
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Hook to set up real-time listeners for database changes
 * and invalidate the appropriate queries when changes occur
 */
export function useRealtimeUpdates(userId: string | undefined) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!userId) return;
    
    console.log("Setting up real-time listeners for user:", userId);
    
    // Channel for events table changes
    const eventsChannel = supabase
      .channel('events-changes')
      .on('postgres_changes', 
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('Events table changed:', payload);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['eventStats'] });
          queryClient.invalidateQueries({ queryKey: ['combinedData'] });
          
          // Show a toast notification for the change
          const eventAction = payload.eventType === 'INSERT' 
            ? 'added' 
            : payload.eventType === 'UPDATE' 
              ? 'updated' 
              : 'removed';
              
          // Safely access payload properties with type checking
          const eventTitle = payload.new && 'title' in payload.new 
            ? payload.new.title as string 
            : payload.old && 'title' in payload.old 
              ? payload.old.title as string 
              : 'Event';
          
          toast(`${eventTitle} ${eventAction}`, {
            description: `Calendar has been updated`,
            duration: 3000
          });
      })
      .subscribe();
    
    // Channel for customers table changes
    const customersChannel = supabase
      .channel('customers-changes')
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('Customers table changed:', payload);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['combinedData'] });
          
          // When customer is created with create_event=true, invalidate events too
          if (payload.new && 'create_event' in payload.new && payload.new.create_event === true) {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            queryClient.invalidateQueries({ queryKey: ['eventStats'] });
          }
          
          const customerAction = payload.eventType === 'INSERT' 
            ? 'added' 
            : payload.eventType === 'UPDATE' 
              ? 'updated' 
              : 'removed';
              
          const customerTitle = payload.new && 'title' in payload.new 
            ? payload.new.title as string 
            : payload.old && 'title' in payload.old 
              ? payload.old.title as string 
              : 'Customer';
          
          toast(`${customerTitle} ${customerAction}`, {
            description: `CRM has been updated`,
            duration: 3000
          });
      })
      .subscribe();
      
    // Channel for tasks table changes
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('Tasks table changed:', payload);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['taskStats'] });
          
          const taskAction = payload.eventType === 'INSERT' 
            ? 'added' 
            : payload.eventType === 'UPDATE' 
              ? 'updated' 
              : 'removed';
              
          const taskTitle = payload.new && 'title' in payload.new 
            ? payload.new.title as string 
            : payload.old && 'title' in payload.old 
              ? payload.old.title as string 
              : 'Task';
          
          toast(`${taskTitle} ${taskAction}`, {
            description: `Task has been updated`,
            duration: 3000
          });
      })
      .subscribe();
      
    // Channel for files changes
    const filesChannel = supabase
      .channel('files-changes')
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'event_files'
        }, 
        (payload) => {
          console.log('Event files changed:', payload);
          
          // Invalidate events and file queries
          queryClient.invalidateQueries({ queryKey: ['events'] });
          queryClient.invalidateQueries({ queryKey: ['eventFiles'] });
        })
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'customer_files_new'
        }, 
        (payload) => {
          console.log('Customer files changed:', payload);
          
          // Invalidate customer and file queries
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['customerFiles'] });
        })
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'files'
        }, 
        (payload) => {
          console.log('Task files changed:', payload);
          
          // Invalidate task file queries
          queryClient.invalidateQueries({ queryKey: ['taskFiles'] });
        })
      .subscribe();
    
    // Cleanup function to remove all channels on unmount
    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(customersChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(filesChannel);
    };
  }, [userId, queryClient]);
}
