
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface BookingRequestNotificationsProps {
  businessId?: string;
}

export const BookingRequestNotifications = ({ businessId }: BookingRequestNotificationsProps) => {
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch initial count of pending booking requests
  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!businessId) return;
      
      try {
        const { data, error } = await supabase
          .from('booking_requests')
          .select('id')
          .eq('business_id', businessId)
          .eq('status', 'pending');
        
        if (error) throw error;
        setPendingCount(data?.length || 0);
      } catch (error) {
        console.error('Error fetching pending booking requests:', error);
      }
    };
    
    fetchPendingRequests();
  }, [businessId]);

  // Set up real-time subscription for new booking requests
  useEffect(() => {
    if (!businessId) return;
    
    // Subscribe to booking_requests table for INSERT events
    const channel = supabase
      .channel('booking-requests-changes')
      .on(
        'postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'booking_requests',
          filter: `business_id=eq.${businessId}`
        }, 
        (payload) => {
          console.log('New booking request received:', payload);
          // Increment the counter
          setPendingCount(prev => prev + 1);
          
          // Play notification sound
          const audio = new Audio('/audio/notification.mp3');
          audio.play().catch(e => console.log('Audio play failed:', e));
          
          // Show toast notification
          toast({
            title: 'New Booking Request',
            description: `${payload.new.requester_name} has requested a booking`,
            action: (
              <button 
                className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs" 
                onClick={() => navigate('/dashboard/booking-requests')}
              >
                View
              </button>
            ),
          });
        }
      )
      .subscribe();
      
    // Clean up subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, toast, navigate]);
  
  // Return null if no pending requests
  if (pendingCount === 0) return null;
  
  // Return badge with count
  return (
    <Badge className="bg-red-500 hover:bg-red-600" variant="secondary">
      {pendingCount}
    </Badge>
  );
};
