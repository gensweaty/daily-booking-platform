import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  type: 'admin' | 'sub_user';
}

interface Participant {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  type: 'admin' | 'sub_user';
  isCurrentUser?: boolean;
}

interface ChannelParticipant {
  user_id?: string;
  sub_user_id?: string;
  user_type: 'admin' | 'sub_user';
}

export const useChannelParticipants = (members: TeamMember[]) => {
  const { user } = useAuth();
  const [participantCache, setParticipantCache] = useState<Map<string, Participant[]>>(new Map());
  const [loading, setLoading] = useState<Map<string, boolean>>(new Map());

  const fetchChannelParticipants = useCallback(async (channelId: string): Promise<Participant[]> => {
    // Check cache first
    if (participantCache.has(channelId)) {
      return participantCache.get(channelId)!;
    }

    // Check if already loading
    if (loading.get(channelId)) {
      return [];
    }

    try {
      setLoading(prev => new Map(prev).set(channelId, true));

      // Fetch channel participants
      const { data: channelParticipants, error } = await supabase
        .from('chat_participants')
        .select('user_id, sub_user_id, user_type')
        .eq('channel_id', channelId);

      if (error) {
        console.error('Error fetching channel participants:', error);
        return [];
      }

      // Map participants to full member info
      const participants: Participant[] = [];
      
      channelParticipants?.forEach((participant: ChannelParticipant) => {
        let member: TeamMember | undefined;
        
        if (participant.user_type === 'admin' && participant.user_id) {
          // Find admin member
          member = members.find(m => m.type === 'admin' && m.id === participant.user_id);
        } else if (participant.user_type === 'sub_user' && participant.sub_user_id) {
          // Find sub-user member
          member = members.find(m => m.type === 'sub_user' && m.id === participant.sub_user_id);
        }

        if (member) {
          participants.push({
            ...member,
            isCurrentUser: (participant.user_type === 'admin' && participant.user_id === user?.id) ||
                          (participant.user_type === 'sub_user' && member.email === user?.email)
          });
        }
      });

      // Sort participants: current user first, then admins, then members
      participants.sort((a, b) => {
        if (a.isCurrentUser && !b.isCurrentUser) return -1;
        if (!a.isCurrentUser && b.isCurrentUser) return 1;
        if (a.type === 'admin' && b.type === 'sub_user') return -1;
        if (a.type === 'sub_user' && b.type === 'admin') return 1;
        return a.name.localeCompare(b.name);
      });

      // Cache the results
      setParticipantCache(prev => new Map(prev).set(channelId, participants));
      
      return participants;
    } catch (error) {
      console.error('Error in fetchChannelParticipants:', error);
      return [];
    } finally {
      setLoading(prev => new Map(prev).set(channelId, false));
    }
  }, [members, user, participantCache, loading]);

  const isLoading = useCallback((channelId: string) => {
    return loading.get(channelId) || false;
  }, [loading]);

  const clearCache = useCallback(() => {
    setParticipantCache(new Map());
    setLoading(new Map());
  }, []);

  return {
    fetchChannelParticipants,
    isLoading,
    clearCache
  };
};