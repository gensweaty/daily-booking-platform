
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GroupMember } from "../GroupMembersField";

export const useGroupMembers = () => {
  const [isLoading, setIsLoading] = useState(false);

  const loadGroupMembers = useCallback(async (eventId: string): Promise<GroupMember[]> => {
    if (!eventId) {
      console.warn("No eventId provided to loadGroupMembers");
      return [];
    }

    setIsLoading(true);
    try {
      console.log("🔍 Loading group members for event:", eventId);
      
      const { data: members, error } = await supabase
        .from('customers')
        .select('*')
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error("❌ Error loading group members:", error);
        return [];
      }
      
      const groupMembers: GroupMember[] = (members || []).map(member => ({
        id: member.id,
        user_surname: member.user_surname || '',
        user_number: member.user_number || '',
        social_network_link: member.social_network_link || '',
        event_notes: member.event_notes || '',
        payment_status: member.payment_status || 'not_paid',
        payment_amount: member.payment_amount?.toString() || '',
      }));
      
      console.log("✅ Loaded group members:", { count: groupMembers.length });
      return groupMembers;
      
    } catch (error) {
      console.error("💥 Exception loading group members:", error);
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
    if (!eventId || !userId) {
      console.error("Missing required parameters for saveGroupMembers");
      return false;
    }

    setIsLoading(true);
    try {
      console.log("💾 Saving group members for event:", eventId, "Count:", groupMembers.length);
      
      // First, delete existing group members
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true);
      
      if (deleteError) {
        console.error('❌ Error deleting existing group members:', deleteError);
        return false;
      }

      // Then, create new group members if any exist
      if (groupMembers.length === 0) {
        console.log("✅ No group members to save");
        return true;
      }

      for (const [index, member] of groupMembers.entries()) {
        const customerData = {
          title: member.user_surname || `Member ${index + 1}`,
          user_surname: member.user_surname || '',
          user_number: member.user_number || '',
          social_network_link: member.social_network_link || '',
          event_notes: member.event_notes || '',
          payment_status: member.payment_status || 'not_paid',
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
          console.error('❌ Error creating group member:', customerError, 'Data:', customerData);
          return false;
        } else {
          console.log('✅ Created customer for group member:', member.user_surname);
        }
      }
      
      console.log("✅ All group members saved successfully");
      return true;
      
    } catch (error) {
      console.error("💥 Exception saving group members:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateGroupEvent = useCallback(async (eventId: string): Promise<{
    isValid: boolean;
    memberCount: number;
    issues: string[];
  }> => {
    try {
      console.log("🔍 Validating group event:", eventId);
      
      // Check event exists and is marked as group event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('is_group_event, group_name, group_member_count')
        .eq('id', eventId)
        .single();
        
      if (eventError || !event) {
        return {
          isValid: false,
          memberCount: 0,
          issues: ['Event not found']
        };
      }
      
      // Check group members
      const { data: members, error: membersError } = await supabase
        .from('customers')
        .select('id')
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true);
        
      if (membersError) {
        return {
          isValid: false,
          memberCount: 0,
          issues: ['Failed to load group members']
        };
      }
      
      const memberCount = members?.length || 0;
      const issues: string[] = [];
      
      // Validation checks
      if (!event.is_group_event) {
        issues.push('Event not marked as group event');
      }
      
      if (!event.group_name) {
        issues.push('Group name missing');
      }
      
      if (memberCount === 0) {
        issues.push('No group members found');
      }
      
      if (event.group_member_count !== memberCount) {
        issues.push(`Member count mismatch: expected ${event.group_member_count}, found ${memberCount}`);
      }
      
      const isValid = issues.length === 0;
      
      console.log("🔍 Group event validation result:", {
        eventId,
        isValid,
        memberCount,
        issues
      });
      
      return {
        isValid,
        memberCount,
        issues
      };
      
    } catch (error) {
      console.error("💥 Exception validating group event:", error);
      return {
        isValid: false,
        memberCount: 0,
        issues: ['Validation failed with exception']
      };
    }
  }, []);

  return {
    loadGroupMembers,
    saveGroupMembers,
    validateGroupEvent,
    isLoading,
  };
};
