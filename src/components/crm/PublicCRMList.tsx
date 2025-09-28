import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useLanguage } from "@/contexts/LanguageContext";
import { CustomerList } from "./CustomerList";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { startOfMonth, endOfMonth } from 'date-fns';

interface PublicCRMListProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  onlineUsers: { name: string; email: string; avatar_url?: string }[];
  hasPermissions?: boolean;
}

export const PublicCRMList = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail, 
  onlineUsers,
  hasPermissions = false
}: PublicCRMListProps) => {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const queryClient = useQueryClient();

  // Direct data fetching for CRM - similar to Statistics approach
  const currentDate = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState({ 
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Set up real-time subscription for CRM changes
  useEffect(() => {
    if (!boardUserId) return;

    console.log('Setting up real-time subscription for CRM data:', boardUserId);
    
    const channel = supabase
      .channel('public_crm_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `user_id=eq.${boardUserId}`,
        },
        (payload) => {
          console.log('Real-time CRM change detected:', payload);
          // Force re-render of CustomerList component
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['events'] });
        }
      )
      .subscribe((status) => {
        console.log('Real-time CRM subscription status:', status);
      });

    return () => {
      console.log('Cleaning up real-time CRM subscription');
      supabase.removeChannel(channel);
    };
  }, [boardUserId, queryClient]);

  return (
    <div className="space-y-6">
      {/* Direct CustomerList Component - No Auth Override */}
      <CustomerList 
        isPublicMode={true}
        externalUserName={externalUserName}
        externalUserEmail={externalUserEmail}
        publicBoardUserId={boardUserId}
        hasPermissions={hasPermissions}
        onlineUsers={onlineUsers}
        currentUserEmail={externalUserEmail}
      />
    </div>
  );
};