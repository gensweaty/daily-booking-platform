
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GroupParticipant } from '@/components/Calendar/GroupBookingFields';

export const useGroupBooking = () => {
  const { toast } = useToast();

  const createGroupBooking = async (
    eventData: {
      title: string;
      startDate: string;
      endDate: string;
      userSurname: string;
      userNumber: string;
      socialNetworkLink: string;
      eventNotes: string;
      userId: string;
    },
    groupName: string,
    participants: GroupParticipant[]
  ) => {
    try {
      // 1. Create the main group event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          title: eventData.title,
          start_date: eventData.startDate,
          end_date: eventData.endDate,
          user_surname: eventData.userSurname,
          user_number: eventData.userNumber,
          social_network_link: eventData.socialNetworkLink,
          event_notes: eventData.eventNotes,
          user_id: eventData.userId,
          is_group_event: true,
          group_name: groupName,
        })
        .select()
        .single();

      if (eventError) {
        console.error('Error creating group event:', eventError);
        throw eventError;
      }

      // 2. Create customer entries for each participant
      const customerPromises = participants.map(async (participant) => {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .insert({
            title: participant.fullName,
            user_surname: participant.fullName,
            user_number: participant.phoneNumber,
            social_network_link: participant.email,
            event_notes: participant.notes,
            payment_status: participant.paymentStatus,
            payment_amount: participant.paymentAmount ? parseFloat(participant.paymentAmount) : null,
            start_date: eventData.startDate,
            end_date: eventData.endDate,
            create_event: true,
            user_id: eventData.userId,
            parent_group_id: event.id,
            is_group_member: true,
          })
          .select()
          .single();

        if (customerError) {
          console.error('Error creating customer for participant:', participant.fullName, customerError);
          throw customerError;
        }

        return customer;
      });

      await Promise.all(customerPromises);

      toast({
        title: "Group booking created",
        description: `Successfully created group booking "${groupName}" with ${participants.length} participants.`,
      });

      return event;
    } catch (error) {
      console.error('Error in createGroupBooking:', error);
      toast({
        title: "Error",
        description: "Failed to create group booking. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateGroupBooking = async (
    eventId: string,
    eventData: {
      title: string;
      startDate: string;
      endDate: string;
      userSurname: string;
      userNumber: string;
      socialNetworkLink: string;
      eventNotes: string;
    },
    groupName: string,
    participants: GroupParticipant[]
  ) => {
    try {
      // 1. Update the main group event
      const { error: eventError } = await supabase
        .from('events')
        .update({
          title: eventData.title,
          start_date: eventData.startDate,
          end_date: eventData.endDate,
          user_surname: eventData.userSurname,
          user_number: eventData.userNumber,
          social_network_link: eventData.socialNetworkLink,
          event_notes: eventData.eventNotes,
          group_name: groupName,
        })
        .eq('id', eventId);

      if (eventError) {
        console.error('Error updating group event:', eventError);
        throw eventError;
      }

      // 2. Get existing participants
      const { data: existingCustomers, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('parent_group_id', eventId)
        .eq('is_group_member', true);

      if (fetchError) {
        console.error('Error fetching existing participants:', fetchError);
        throw fetchError;
      }

      // 3. Delete existing participants that are not in the new list
      const existingIds = new Set(participants.map(p => p.id).filter(id => !id.startsWith('new_')));
      const toDelete = existingCustomers?.filter(customer => !existingIds.has(customer.id)) || [];
      
      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('customers')
          .delete()
          .in('id', toDelete.map(c => c.id));

        if (deleteError) {
          console.error('Error deleting participants:', deleteError);
          throw deleteError;
        }
      }

      // 4. Update or create participants
      const updatePromises = participants.map(async (participant) => {
        const isNew = participant.id.startsWith('new_') || !existingCustomers?.find(c => c.id === participant.id);
        
        if (isNew) {
          // Create new participant
          const { error: createError } = await supabase
            .from('customers')
            .insert({
              title: participant.fullName,
              user_surname: participant.fullName,
              user_number: participant.phoneNumber,
              social_network_link: participant.email,
              event_notes: participant.notes,
              payment_status: participant.paymentStatus,
              payment_amount: participant.paymentAmount ? parseFloat(participant.paymentAmount) : null,
              start_date: eventData.startDate,
              end_date: eventData.endDate,
              create_event: true,
              user_id: existingCustomers?.[0]?.user_id,
              parent_group_id: eventId,
              is_group_member: true,
            });

          if (createError) {
            console.error('Error creating new participant:', participant.fullName, createError);
            throw createError;
          }
        } else {
          // Update existing participant
          const { error: updateError } = await supabase
            .from('customers')
            .update({
              title: participant.fullName,
              user_surname: participant.fullName,
              user_number: participant.phoneNumber,
              social_network_link: participant.email,
              event_notes: participant.notes,
              payment_status: participant.paymentStatus,
              payment_amount: participant.paymentAmount ? parseFloat(participant.paymentAmount) : null,
              start_date: eventData.startDate,
              end_date: eventData.endDate,
            })
            .eq('id', participant.id);

          if (updateError) {
            console.error('Error updating participant:', participant.fullName, updateError);
            throw updateError;
          }
        }
      });

      await Promise.all(updatePromises);

      toast({
        title: "Group booking updated",
        description: `Successfully updated group booking "${groupName}".`,
      });

      return true;
    } catch (error) {
      console.error('Error in updateGroupBooking:', error);
      toast({
        title: "Error",
        description: "Failed to update group booking. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    createGroupBooking,
    updateGroupBooking,
  };
};
