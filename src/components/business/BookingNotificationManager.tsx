
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare } from 'lucide-react';

interface BookingRequest {
  id: string;
  requester_name: string;
  title: string;
  start_date: string;
  created_at: string;
}

interface BookingNotificationManagerProps {
  businessProfileId: string | null;
  onNewRequest?: () => void;
}

export const BookingNotificationManager = ({ 
  businessProfileId, 
  onNewRequest 
}: BookingNotificationManagerProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const channelRef = useRef<any>(null);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Set up real-time subscription for booking requests
  useEffect(() => {
    if (!businessProfileId || !user?.id) {
      return;
    }

    console.log('Setting up real-time subscription for booking requests');

    // Create channel for real-time updates
    const channel = supabase
      .channel('booking-requests-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_requests',
          filter: `business_id=eq.${businessProfileId}`
        },
        (payload) => {
          console.log('New booking request received:', payload);
          const newRequest = payload.new as BookingRequest;
          
          // Show toast notification
          showToastNotification(newRequest);
          
          // Show browser notification
          showBrowserNotification(newRequest);
          
          // Callback to parent component
          if (onNewRequest) {
            onNewRequest();
          }
        }
      )
      .subscribe((status) => {
        console.log('Booking requests subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('Cleaning up booking requests subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [businessProfileId, user?.id, onNewRequest]);

  const showToastNotification = (request: BookingRequest) => {
    const isGeorgian = language === 'ka';
    
    toast({
      title: isGeorgian ? "ახალი ჯავშნის მოთხოვნა!" : "New Booking Request!",
      description: isGeorgian 
        ? `${request.requester_name}-ისგან: ${request.title}`
        : `From ${request.requester_name}: ${request.title}`,
      duration: 10000, // Show for 10 seconds
      className: "bg-blue-50 border-blue-200 text-blue-900",
    });
  };

  const showBrowserNotification = (request: BookingRequest) => {
    if (notificationPermission === 'granted' && 'Notification' in window) {
      const isGeorgian = language === 'ka';
      
      const notification = new Notification(
        isGeorgian ? "ახალი ჯავშნის მოთხოვნა!" : "New Booking Request!",
        {
          body: isGeorgian 
            ? `${request.requester_name}-ისგან: ${request.title}`
            : `From ${request.requester_name}: ${request.title}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `booking-request-${request.id}`,
          requireInteraction: true,
        }
      );

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      // Handle click to focus the window
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  };

  return null; // This component doesn't render anything visible
};
