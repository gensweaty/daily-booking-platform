
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare, Bell } from 'lucide-react';
import { platformNotificationManager } from '@/utils/platformNotificationManager';

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

  // Request browser notification permission on component mount
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

    // Create channel for real-time updates with unique channel name
    const channelName = `booking-requests-${businessProfileId}`;
    const channel = supabase
      .channel(channelName)
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
            
            // Show toast notification immediately
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
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to booking request notifications');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to booking request notifications');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('Cleaning up booking requests subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [businessProfileId, user?.id, onNewRequest, language, t]);

  const showNewRequestToast = (request: BookingRequest) => {
    console.log('Showing toast notification for new booking request:', request.id, 'Language:', language);
    
    // Use toast with proper translation keys for all three languages
    toast({
      translateKeys: {
        titleKey: "bookings.newRequest",
        descriptionKey: "bookings.newRequestFrom"
      },
      translateParams: {
        name: request.requester_name,
        title: request.title
      },
      duration: 15000, // Show for 15 seconds to ensure visibility
      className: "bg-orange-50 border-orange-200 text-orange-900 shadow-lg",
      action: (
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="font-medium">
            {language === 'ka' ? "იხილეთ" : language === 'es' ? "Ver" : "View"}
          </span>
        </div>
      ),
    });
  };

  const showBrowserNotification = (request: BookingRequest) => {
    if (notificationPermission === 'granted' && 'Notification' in window) {
      console.log('Showing browser notification for new booking request:', request.id, 'Language:', language);
      
      // Create platform-optimized notification
      const notificationOptions = {
        title: language === 'ka' ? "ახალი ჯავშნის მოთხოვნა!" : 
               language === 'es' ? "¡Nueva Solicitud de Reserva!" : 
               "New Booking Request!",
        body: language === 'ka' ? `${request.requester_name}-ისგან: ${request.title}` :
              language === 'es' ? `De ${request.requester_name}: ${request.title}` :
              `From ${request.requester_name}: ${request.title}`,
        icon: '/favicon.ico',
        tag: `booking-request-${request.id}`,
        requireInteraction: true,
      };

      platformNotificationManager.createNotification(notificationOptions)
        .then((result) => {
          if (result.success && result.notification) {
            console.log('✅ Browser notification created successfully');
            
            // Handle click to focus the window
            result.notification.onclick = () => {
              window.focus();
              result.notification?.close();
            };
            
            // Auto-close after 15 seconds
            setTimeout(() => {
              result.notification?.close();
            }, 15000);
          } else {
            console.error('❌ Failed to create browser notification:', result.error);
          }
        })
        .catch((error) => {
          console.error('❌ Error creating browser notification:', error);
        });
    } else {
      console.log('Browser notifications not available or not permitted:', { 
        permission: notificationPermission, 
        hasNotification: 'Notification' in window 
      });
    }
  };

  return null; // This component doesn't render anything visible
};
