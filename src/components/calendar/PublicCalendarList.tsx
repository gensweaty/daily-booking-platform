import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CalendarEventType, CalendarViewType } from "@/lib/types/calendar";
import { PublicCalendarComponent } from "./PublicCalendarComponent";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface PublicCalendarListProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  onlineUsers: { name: string; email: string }[];
}

export const PublicCalendarList = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail, 
  onlineUsers 
}: PublicCalendarListProps) => {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  // Fetch events using RPC function for public access
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['publicCalendarEvents', boardUserId],
    queryFn: async () => {
      console.log('Fetching public calendar events for user:', boardUserId);
      const { data, error } = await supabase
        .rpc('get_public_events_by_user_id', { user_id_param: boardUserId });
      
      if (error) {
        console.error('Error fetching public calendar events:', error);
        throw error;
      }
      
      console.log('Fetched calendar events:', data);
      return (data || []) as CalendarEventType[];
    },
    enabled: !!boardUserId,
    refetchInterval: false,
  });

  // Set up real-time subscription for calendar changes
  useEffect(() => {
    if (!boardUserId) return;

    console.log('Setting up real-time subscription for calendar events:', boardUserId);
    
    const channel = supabase
      .channel('public_calendar_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${boardUserId}`,
        },
        (payload) => {
          console.log('Real-time calendar change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['publicCalendarEvents', boardUserId] });
        }
      )
      .subscribe((status) => {
        console.log('Real-time calendar subscription status:', status);
      });

    return () => {
      console.log('Cleaning up real-time calendar subscription');
      supabase.removeChannel(channel);
    };
  }, [boardUserId, queryClient]);

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div 
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header skeleton */}
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="w-32 h-8 bg-muted rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-20 h-8 bg-muted rounded animate-pulse" />
          </div>
        </div>
        
        {/* Calendar skeleton */}
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile: Header line with Calendar left, circles center */}
      <div className="grid sm:hidden grid-cols-[auto_1fr] items-center w-full">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.calendar')}</h2>
        <div className="flex items-center justify-center">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Desktop: Header with presence left aligned */}
      <div className="hidden sm:flex flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.calendar')}</h2>
        <div className="flex items-center gap-3">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Calendar Component with Add Event functionality for sub-users */}
      <PublicCalendarComponent 
        boardUserId={boardUserId}
        externalUserName={externalUserName}
        externalUserEmail={externalUserEmail}
        events={events}
      />
    </div>
  );
};