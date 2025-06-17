
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { GroupMember } from "../GroupMembersField";

export const useGroupMembers = (eventId?: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const loadGroupMembers = async (parentGroupId: string): Promise<GroupMember[]> => {
    if (!parentGroupId) return [];
    
    try {
      console.log("Loading group members for event:", parentGroupId);
      
      const { data: groupMemberCustomers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('parent_group_id', parentGroupId)
        .eq('is_group_member', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error loading group members:", error);
        return [];
      }

      if (groupMemberCustomers && groupMemberCustomers.length > 0) {
        console.log("Loaded group members from customers:", groupMemberCustomers);
        
        return groupMemberCustomers.map(customer => ({
          id: customer.id,
          user_surname: customer.user_surname || customer.title || "",
          user_number: customer.user_number || "",
          social_network_link: customer.social_network_link || "",
          event_notes: customer.event_notes || "",
          payment_status: customer.payment_status || "not_paid",
          payment_amount: customer.payment_amount?.toString() || ""
        }));
      }

      return [];
    } catch (error) {
      console.error("Exception loading group members:", error);
      return [];
    }
  };

  const saveMember = async (member: GroupMember, parentGroupId: string, startDate: string, endDate: string) => {
    if (!user || !parentGroupId) return false;

    setIsLoading(true);
    try {
      const customerData = {
        id: member.id === crypto.randomUUID() ? undefined : member.id, // Only include ID if it's not a new UUID
        title: member.user_surname,
        user_surname: member.user_surname,
        user_number: member.user_number,
        social_network_link: member.social_network_link,
        event_notes: member.event_notes,
        payment_status: member.payment_status,
        payment_amount: member.payment_amount ? parseFloat(member.payment_amount) : null,
        user_id: user.id,
        type: 'group_member',
        start_date: startDate,
        end_date: endDate,
        parent_group_id: parentGroupId,
        is_group_member: true
      };

      const { error } = await supabase
        .from('customers')
        .upsert(customerData, { onConflict: 'id' });

      if (error) {
        console.error('Error saving group member:', error);
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "common.errorOccurred"
          }
        });
        return false;
      }

      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "events.memberSaved"
        }
      });
      
      return true;
    } catch (error) {
      console.error("Exception saving member:", error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMember = async (memberId: string) => {
    if (!user) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', memberId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting group member:', error);
        toast({
          translateKeys: {
            titleKey: "common.error",
            descriptionKey: "common.errorOccurred"
          }
        });
        return false;
      }

      toast({
        translateKeys: {
          titleKey: "common.success",
          descriptionKey: "events.memberDeleted"
        }
      });
      
      return true;
    } catch (error) {
      console.error("Exception deleting member:", error);
      toast({
        translateKeys: {
          titleKey: "common.error",
          descriptionKey: "common.errorOccurred"
        }
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    loadGroupMembers,
    saveMember,
    deleteMember,
    isLoading
  };
};
