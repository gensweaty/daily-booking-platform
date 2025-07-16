
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare, Bell } from 'lucide-react';

interface BookingRequest {
  id: string;
  requester_name: string;
  title: string;
  start_date: string;
  created_at: string;
  status: string;
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
      console.log('BookingNotificationManager: Missing businessProfileId or user.id', { businessProfileId, userId: user?.id });
      return;
    }

    console.log('Setting up real-time subscription for booking requests, businessProfileId:', businessProfileId);

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
          console.log('New booking request received via realtime:', payload);
          const newRequest = payload.new as BookingRequest;
          
          // Only show notification for pending requests
          if (newRequest.status === 'pending') {
            console.log('Showing notification for pending booking request:', newRequest.id);
            
            // Show toast notification
            showNewRequestToast(newRequest);
            
            // Show browser notification
            showBrowserNotification(newRequest);
            
            // Callback to parent component
            if (onNewRequest) {
              onNewRequest();
            }
          } else {
            console.log('Skipping notification for non-pending request:', newRequest.status);
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

  const showNewRequestToast = (request: BookingRequest) => {
    const isGeorgian = language === 'ka';
    
    console.log('Showing toast notification for new booking request:', request.id);
    
    toast({
      title: isGeorgian ? "ახალი ჯავშნის მოთხოვნა!" : "New Booking Request!",
      description: isGeorgian 
        ? `${request.requester_name}-ისგან: ${request.title}`
        : `From ${request.requester_name}: ${request.title}`,
      duration: 15000, // Show for 15 seconds to ensure visibility
      className: "bg-orange-50 border-orange-200 text-orange-900 shadow-lg",
      action: (
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="font-medium">
            {isGeorgian ? "შეამოწმეთ" : "Check Now"}
          </span>
        </div>
      ),
    });
  };

  const showBrowserNotification = (request: BookingRequest) => {
    if (notificationPermission === 'granted' && 'Notification' in window) {
      const isGeorgian = language === 'ka';
      
      console.log('Showing browser notification for new booking request:', request.id);
      
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

      // Auto-close after 15 seconds
      setTimeout(() => {
        notification.close();
      }, 15000);

      // Handle click to focus the window
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else {
      console.log('Browser notifications not available or not permitted:', { 
        permission: notificationPermission, 
        hasNotification: 'Notification' in window 
      });
    }
  };

  return null; // This component doesn't render anything visible
};
