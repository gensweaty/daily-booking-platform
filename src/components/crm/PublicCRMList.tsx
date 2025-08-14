import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { CustomerList } from "./CustomerList";

interface PublicCRMListProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  onlineUsers: { name: string; email: string }[];
}

export const PublicCRMList = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail, 
  onlineUsers 
}: PublicCRMListProps) => {
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  // Fetch customers data directly
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['publicCustomers', boardUserId],
    queryFn: async () => {
      console.log('Fetching public CRM data for user:', boardUserId);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', boardUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching public CRM data:', error);
        throw error;
      }
      
      console.log('Fetched customers:', data);
      return data || [];
    },
    enabled: !!boardUserId,
    refetchInterval: false,
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
          queryClient.invalidateQueries({ queryKey: ['publicCustomers', boardUserId] });
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
        
        {/* CRM content skeleton */}
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 w-full bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mobile: Header line with CRM left, circles center */}
      <div className="grid sm:hidden grid-cols-[auto_1fr] items-center w-full">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.crm')}</h2>
        <div className="flex items-center justify-center">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Desktop: Header with presence left aligned */}
      <div className="hidden sm:flex flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.crm')}</h2>
        <div className="flex items-center gap-3">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Customer List Component - For now, use an empty placeholder as CustomerList needs modification */}
      <div className="p-4 border rounded-lg">
        <p className="text-muted-foreground text-center">
          CRM functionality is view-only in public mode. {customers.length} customers found.
        </p>
        {customers.length > 0 && (
          <div className="mt-4 space-y-2">
            {customers.slice(0, 5).map((customer, index) => (
              <div key={customer.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span className="font-medium">{customer.title}</span>
                <span className="text-sm text-muted-foreground">{customer.payment_status || 'No status'}</span>
              </div>
            ))}
            {customers.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                ...and {customers.length - 5} more customers
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};