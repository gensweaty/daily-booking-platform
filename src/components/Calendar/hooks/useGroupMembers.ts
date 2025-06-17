
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GroupMember } from "../GroupMembersField";

export const useGroupMembers = () => {
  const [isLoading, setIsLoading] = useState(false);

  const loadGroupMembers = async (eventId: string): Promise<GroupMember[]> => {
    setIsLoading(true);
    try {
      console.log("Loading group members for event:", eventId);
      
      const { data: members, error } = await supabase
        .from('customers')
        .select('*')
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true);
        
      if (error) {
        console.error("Error loading group members:", error);
        return [];
      }
      
      console.log("Loaded group members:", members);
      
      return (members || []).map(member => ({
        id: member.id,
        user_surname: member.user_surname || '',
        user_number: member.user_number || '',
        social_network_link: member.social_network_link || '',
        event_notes: member.event_notes || '',
        payment_status: member.payment_status || 'not_paid',
        payment_amount: member.payment_amount?.toString() || '',
      }));
    } catch (error) {
      console.error("Exception loading group members:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    loadGroupMembers,
    isLoading,
  };
};
