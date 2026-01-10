import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';

interface BookingRequest {
  id: string;
  requester_name: string;
  title: string;
  start_date: string;
  created_at: string;
  status: string;
}

/**
 * Global listener for booking request notifications.
 * This component should be mounted at the dashboard level to ensure
 * notifications are received regardless of which tab is active.
 */
export const GlobalBookingNotificationListener = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const channelRef = useRef<any>(null);
  const lastNotifiedIdRef = useRef<string | null>(null);

  // Fetch the user's business profile ID
  const { data: businessProfile } = useQuery({
    queryKey: ['businessProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const businessProfileId = businessProfile?.id;

  // Set up real-time subscription for booking requests
  useEffect(() => {
    if (!businessProfileId || !user?.id) {
      return;
    }

    console.log('[GlobalBookingNotificationListener] Setting up subscription for business:', businessProfileId);

    // Create channel for real-time updates
    const channel = supabase
      .channel(`global-booking-requests-${businessProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_requests',
          filter: `business_id=eq.${businessProfileId}`
        },
        async (payload) => {
          console.log('[GlobalBookingNotificationListener] New booking request:', payload);
          const newRequest = payload.new as BookingRequest;
          
          // Prevent duplicate notifications
          if (lastNotifiedIdRef.current === newRequest.id) {
            console.log('[GlobalBookingNotificationListener] Duplicate notification prevented');
            return;
          }
          
          // Only show notification for pending requests
          if (newRequest.status === 'pending') {
            lastNotifiedIdRef.current = newRequest.id;
            
            const isGeorgian = language === 'ka';
            const title = isGeorgian ? "ახალი ჯავშნის მოთხოვნა!" : "New Booking Request!";
            const description = isGeorgian 
              ? `${newRequest.requester_name}-ისგან: ${newRequest.title}`
              : `From ${newRequest.requester_name}: ${newRequest.title}`;

            // Play notification sound
            try {
              const { playNotificationSound } = await import('@/utils/audioManager');
              await playNotificationSound();
              console.log('[GlobalBookingNotificationListener] Sound played');
            } catch (error) {
              console.warn('[GlobalBookingNotificationListener] Failed to play sound:', error);
            }

            // Emit to Dynamic Island
            window.dispatchEvent(new CustomEvent('dashboard-notification', {
              detail: {
                type: 'booking',
                title,
                message: description,
                actionData: { bookingId: newRequest.id }
              }
            }));

            console.log('[GlobalBookingNotificationListener] Notification dispatched to Dynamic Island');
          }
        }
      )
      .subscribe((status) => {
        console.log('[GlobalBookingNotificationListener] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('[GlobalBookingNotificationListener] Cleaning up subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [businessProfileId, user?.id, language]);

  return null;
};
