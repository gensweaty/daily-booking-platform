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
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const seedRef = useRef(false);

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

  // Shared dispatcher so realtime and polling produce identical notifications
  const notifyRef = useRef<(r: BookingRequest) => Promise<void>>();
  notifyRef.current = async (newRequest: BookingRequest) => {
    if (notifiedIdsRef.current.has(newRequest.id)) return;
    notifiedIdsRef.current.add(newRequest.id);

    const isGeorgian = language === 'ka';
    const title = isGeorgian ? "ახალი ჯავშნის მოთხოვნა!" : "New Booking Request!";
    const description = isGeorgian
      ? `${newRequest.requester_name}-ისგან: ${newRequest.title}`
      : `From ${newRequest.requester_name}: ${newRequest.title}`;

    try {
      const { playNotificationSound } = await import('@/utils/audioManager');
      await playNotificationSound();
    } catch (error) {
      console.warn('[GlobalBookingNotificationListener] Failed to play sound:', error);
    }

    window.dispatchEvent(new CustomEvent('dashboard-notification', {
      detail: {
        type: 'booking',
        title,
        message: description,
        actionData: { bookingId: newRequest.id },
        targetAudience: 'internal',
      }
    }));
  };

  // Safety-net polling: if realtime drops or the socket never connects,
  // new pending requests still reach the Dynamic Island.
  useEffect(() => {
    if (!businessProfileId || !user?.id) return;

    const seenKey = `booking-notified-${user.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(seenKey) || '[]') as string[];
      stored.forEach(id => notifiedIdsRef.current.add(id));
    } catch { /* ignore */ }

    let cancelled = false;

    const poll = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('booking_requests')
        .select('id, requester_name, title, start_date, created_at, status')
        .eq('business_id', businessProfileId)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(50);

      if (cancelled || error || !data) return;

      if (!seedRef.current) {
        // First pass: remember what already exists without alerting for history
        data.forEach(r => notifiedIdsRef.current.add(r.id));
        seedRef.current = true;
      } else {
        for (const r of data) {
          await notifyRef.current?.(r as BookingRequest);
        }
      }

      try {
        localStorage.setItem(seenKey, JSON.stringify(Array.from(notifiedIdsRef.current).slice(-200)));
      } catch { /* ignore */ }
    };

    poll();
    const interval = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [businessProfileId, user?.id]);

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

          if (newRequest.status === 'pending') {
            lastNotifiedIdRef.current = newRequest.id;
            seedRef.current = true;
            await notifyRef.current?.(newRequest);
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
