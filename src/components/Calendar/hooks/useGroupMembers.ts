
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GroupMember } from "../GroupMembersField";

export const useGroupMembers = () => {
  const [isLoading, setIsLoading] = useState(false);

  const loadGroupMembers = useCallback(async (eventId: string): Promise<GroupMember[]> => {
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
  }, []);

  const saveGroupMembers = useCallback(async (
    eventId: string, 
    groupMembers: GroupMember[], 
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log("Saving group members for event:", eventId, "Members:", groupMembers.length);
      
      // Delete existing group members if updating
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true);
      
      if (deleteError) {
        console.error('Error deleting existing group members:', deleteError);
        return false;
      }

      // Create individual customer records for each group member
      for (const member of groupMembers) {
        const customerData = {
          title: member.user_surname,
          user_surname: member.user_surname,
          user_number: member.user_number,
          social_network_link: member.social_network_link,
          event_notes: member.event_notes,
          payment_status: member.payment_status,
          payment_amount: member.payment_amount ? parseFloat(member.payment_amount) : null,
          user_id: userId,
          type: 'group_member',
          start_date: startDate,
          end_date: endDate,
          parent_group_id: eventId,
          is_group_member: true
        };

        const { error: customerError } = await supabase
          .from('customers')
          .insert(customerData);

        if (customerError) {
          console.error('Error creating group member customer:', customerError);
          return false;
        } else {
          console.log('Created customer for group member:', member.user_surname);
        }
      }
      
      console.log("✅ All group members saved successfully");
      return true;
    } catch (error) {
      console.error("Exception saving group members:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    loadGroupMembers,
    saveGroupMembers,
    isLoading,
  };
};
