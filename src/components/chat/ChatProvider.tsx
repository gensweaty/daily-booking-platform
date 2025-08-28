import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicBoardAuth } from "@/contexts/PublicBoardAuthContext";
import { ChatIcon } from "./ChatIcon";
import { ChatWindow } from "./ChatWindow";
import { resolveAvatarUrl } from "./_avatar";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedNotifications } from '@/hooks/useEnhancedNotifications';
import { useUnreadManager } from '@/hooks/useUnreadManager';
import { useEnhancedRealtimeChat } from '@/hooks/useEnhancedRealtimeChat';

type Me = { 
  id: string; 
  type: "admin" | "sub_user"; 
  name: string; 
  email?: string;
  avatarUrl?: string 
};

type ChatCtx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isInitialized: boolean;
  hasSubUsers: boolean;
  me: Me | null;
  currentChannelId: string | null;
  setCurrentChannelId: (id: string | null) => void;
  openChannel: (id: string) => void;
  startDM: (otherId: string, otherType: "admin" | "sub_user") => void;
  unreadTotal: number;
  channelUnreads: { [channelId: string]: number };
  boardOwnerId: string | null;
  connectionStatus: string;
};

const ChatContext = createContext<ChatCtx | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { user: publicBoardUser } = usePublicBoardAuth();

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [boardOwnerId, setBoardOwnerId] = useState<string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [hasSubUsers, setHasSubUsers] = useState(false);

  // Portal root - memoized to prevent re-creation
  const portalRoot = useMemo(() => {
    let root = document.getElementById('chat-portal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'chat-portal-root';
      root.style.position = 'fixed';
      root.style.top = '0';
      root.style.left = '0';
      root.style.width = '100%';
      root.style.height = '100%';
      root.style.pointerEvents = 'none';
      root.style.zIndex = '9998';
      document.body.appendChild(root);
    }
    return root;
  }, []);

  // Determine context variables
  const isOnPublicBoard = location.pathname.startsWith('/board/');
  const isOnDashboard = location.pathname === '/dashboard';
  const effectiveUser = isOnPublicBoard ? publicBoardUser : user;

  // Determine if chat should be shown - memoized to prevent re-renders
  const shouldShowChat = useMemo(() => {
    return (isOnDashboard && !!user) || isOnPublicBoard;
  }, [location.pathname, user, isOnDashboard, isOnPublicBoard]);

  console.log('🔍 ChatProvider render:', {
    hasSubUsers,
    isInitialized,
    hasUser: !!user,
    shouldShowChat,
    me,
    boardOwnerId
  });

  // Enhanced unread management - memoized dependencies
  const {
    unreadTotal,
    channelUnreads,
    incrementUnread,
    clearChannelUnread,
    clearAllUnread,
  } = useUnreadManager(currentChannelId, isOpen);

  // Enhanced notifications - request permission immediately
  const { requestPermission, showNotification } = useEnhancedNotifications();

  // Memoized real-time message handler to prevent re-renders
  const handleNewMessage = useCallback((message: any) => {
    console.log('📨 Enhanced realtime message received:', message);

    // Only process messages for this board
    if (message.owner_id !== boardOwnerId) {
      console.log('⏭️ Skipping message - owner mismatch');
      return;
    }

    // Skip my own messages for notifications but NOT for display
    const isMyMessage = me?.type === 'admin' 
      ? message.sender_user_id === me.id 
      : message.sender_sub_user_id === me.id;

    if (!isMyMessage) {
      // Increment unread count for channel
      incrementUnread(message.channel_id);

      // Show notification if chat is closed or different channel
      if (!isOpen || currentChannelId !== message.channel_id) {
        console.log('🔔 Showing notification for message:', message);
        showNotification({
          title: `${message.sender_name || 'Someone'} messaged`,
          body: message.content,
          channelId: message.channel_id,
          senderId: message.sender_user_id || message.sender_sub_user_id || 'unknown',
          senderName: message.sender_name || 'Unknown',
        });
      }
    } else {
      console.log('⏭️ Skipping notification - own message');
    }

    // BROADCAST MESSAGE TO ALL CHAT AREAS for immediate display
    window.dispatchEvent(new CustomEvent('chat-message-received', {
      detail: { message }
    }));
  }, [boardOwnerId, me, isOpen, currentChannelId, incrementUnread, showNotification]);

  // Enhanced realtime connection with memoized handler
  const { connectionStatus } = useEnhancedRealtimeChat({
    onNewMessage: handleNewMessage,
    userId: me?.id,
    boardOwnerId: boardOwnerId || undefined,
    enabled: shouldShowChat && isInitialized && !!boardOwnerId,
  });

  // Request notification permission and preload audio on mount
  useEffect(() => {
    if (shouldShowChat) {
      console.log('🔔 Requesting notification permission and preloading audio...');
      
      // Request notification permission
      requestPermission().then((granted) => {
        console.log('🔔 Notification permission:', granted ? 'granted' : 'denied');
      });
      
      // Preload notification sound
      import('@/utils/audioManager').then(({ preloadNotificationSound }) => {
        preloadNotificationSound();
      });
    }
  }, [shouldShowChat, requestPermission]);

  // Chat control functions - memoized to prevent re-renders
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(!isOpen), [isOpen]);

  const openChannel = useCallback((channelId: string) => {
    setCurrentChannelId(channelId);
    clearChannelUnread(channelId);
    setIsOpen(true);
  }, [clearChannelUnread]);

  // Initialize user identity and board owner
  useEffect(() => {
    let active = true;
    
    (async () => {
      console.log('🔍 Initializing chat for:', { 
        user: user?.email, 
        userId: user?.id,
        shouldShowChat, 
        path: location.pathname,
        isOnPublicBoard,
        effectiveUser: effectiveUser?.email,
        publicBoardUser: publicBoardUser?.email
      });
      
      if (!shouldShowChat) {
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          setIsInitialized(true);
        }
        return;
      }

      try {
        // Handle PUBLIC BOARD ACCESS FIRST (including authenticated sub-users on public boards)
        if (isOnPublicBoard) {
          console.log('🔍 Public board access detected');
          
          const pathParts = location.pathname.split('/');
          const slug = pathParts[pathParts.length - 1];
          
          // Check if we have local storage access data for this board
          const storedData = localStorage.getItem(`public-board-access-${slug}`);
          if (storedData) {
            try {
              const parsedData = JSON.parse(storedData);
              const { token, fullName: storedFullName, email: storedEmail, boardOwnerId: storedBoardOwnerId } = parsedData;
              
              console.log('🔍 PUBLIC BOARD: Parsing stored access data:', { 
                hasToken: !!token,
                storedFullName, 
                storedEmail,
                storedBoardOwnerId 
              });
              
              if (token && storedFullName && storedBoardOwnerId && storedEmail) {
                console.log('✅ Found stored public board access - searching for sub-user record');
                
                // Enhanced sub-user lookup with multiple strategies
                console.log('🔍 Strategy 1: Exact email match');
                let { data: subUser, error: subUserError } = await supabase
                  .from("sub_users")
                  .select("id, fullname, avatar_url, email")
                  .eq("board_owner_id", storedBoardOwnerId)
                  .ilike("email", storedEmail.trim().toLowerCase())
                  .maybeSingle();
                
                if (subUserError) {
                  console.error('❌ Strategy 1 error:', subUserError);
                }
                
                // Strategy 2: If no exact match, try searching by name
                if (!subUser?.id) {
                  console.log('🔍 Strategy 2: Searching by name');
                  const { data: nameMatch } = await supabase
                    .from("sub_users")
                    .select("id, fullname, avatar_url, email")
                    .eq("board_owner_id", storedBoardOwnerId)
                    .ilike("fullname", storedFullName.trim())
                    .maybeSingle();
                  
                  if (nameMatch?.id) {
                    console.log('✅ Found sub-user by name match:', nameMatch);
                    subUser = nameMatch;
                  }
                }
                
                // Strategy 3: List all sub-users for this board to debug
                if (!subUser?.id) {
                  console.log('🔍 Strategy 3: Debugging - listing all sub-users for board');
                  const { data: allSubUsers } = await supabase
                    .from("sub_users")
                    .select("id, fullname, avatar_url, email")
                    .eq("board_owner_id", storedBoardOwnerId);
                  
                  console.log('🔍 All sub-users for board:', allSubUsers?.map(u => ({
                    id: u.id,
                    email: u.email,
                    fullname: u.fullname,
                    emailMatch: u.email?.toLowerCase() === storedEmail.toLowerCase(),
                    nameMatch: u.fullname?.toLowerCase() === storedFullName.toLowerCase()
                  })));
                  
                  // Try to find any matching user from the list
                  const potentialMatch = allSubUsers?.find(u => 
                    u.email?.toLowerCase().includes(storedEmail.toLowerCase()) ||
                    u.fullname?.toLowerCase().includes(storedFullName.toLowerCase()) ||
                    storedEmail.toLowerCase().includes(u.email?.toLowerCase() || '') ||
                    storedFullName.toLowerCase().includes(u.fullname?.toLowerCase() || '')
                  );
                  
                  if (potentialMatch) {
                    console.log('✅ Found potential match via fuzzy search:', potentialMatch);
                    subUser = potentialMatch;
                  }
                }
                
                if (subUser?.id) {
                  console.log('✅ SUCCESS: Found sub-user record for PUBLIC BOARD:', { 
                    id: subUser.id, 
                    name: subUser.fullname,
                    email: subUser.email,
                    avatarUrl: subUser.avatar_url,
                    boardOwnerId: storedBoardOwnerId 
                  });
                  
                  const subUserIdentity = {
                    id: subUser.id,
                    type: "sub_user" as const, 
                    name: subUser.fullname || storedFullName,
                    email: storedEmail,
                    avatarUrl: resolveAvatarUrl(subUser.avatar_url)
                  };
                  
                  console.log('🔧 Creating sub-user identity for PUBLIC BOARD:', subUserIdentity);
                  
                  if (active) {
                    setBoardOwnerId(storedBoardOwnerId);
                    setMe(subUserIdentity);
                    setIsInitialized(true);
                    console.log('🎉 PUBLIC BOARD: Chat initialized for sub-user with identity:', subUserIdentity);
                  }
                  return;
                } else {
                  console.log('❌ FAILED: Sub-user record not found in database');
                  console.log('💡 Searched for email:', storedEmail, 'and name:', storedFullName);
                  console.log('💡 Chat functionality requires a valid sub-user database record');
                  
                  // Initialize without chat functionality
                  if (active) {
                    setBoardOwnerId(storedBoardOwnerId);
                    setMe(null); // No chat access without database record
                    setIsInitialized(true);
                  }
                  return;
                }
              }
            } catch (error) {
              console.error('❌ Error parsing stored access data:', error);
            }
          }
          
          console.log('⚠️ No valid public board access found');
        }
        
        // Handle authenticated users (admin and sub-users) - FIXED
        if (user?.id) {
          console.log('🔍 Checking authenticated user:', { 
            email: user.email, 
            userId: user.id 
          });
          
          // Try admin first - check profiles table
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          
          console.log('🔍 Profile query result:', { 
            profile, 
            profileError: profileError?.message,
            hasProfile: !!profile 
          });
          
          if (active && profile) {
            console.log('✅ Admin user detected:', profile.username);
            
            // Use email local part if username is auto-generated
            const displayName = profile.username?.startsWith('user_') 
              ? (user.email?.split('@')[0] || 'Admin')
              : (profile.username || 'Admin');
            
            setBoardOwnerId(user.id);
            setMe({
              id: profile.id,
              type: "admin",
              name: displayName,
              email: user.email || undefined,
              avatarUrl: resolveAvatarUrl(profile.avatar_url)
            });
            setIsInitialized(true);
            return;
          }
          
          // Try sub-user by email match (case-insensitive)
          const userEmail = user.email?.toLowerCase();
          if (userEmail) {
            console.log('🔍 Looking for sub-user with email:', userEmail);
            
            const { data: subUser, error: subUserError } = await supabase
              .from("sub_users")
              .select("*")
              .ilike("email", userEmail)
              .maybeSingle();

            if (subUserError) {
              console.log('⚠️ Sub-user query error:', subUserError);
            }

            if (active && subUser) {
              console.log('✅ Sub-user detected:', { 
                id: subUser.id,
                fullname: subUser.fullname, 
                boardOwnerId: subUser.board_owner_id 
              });
              
              setBoardOwnerId(subUser.board_owner_id);
              setMe({
                id: subUser.id,
                type: "sub_user",
                name: subUser.fullname || "Member",
                email: subUser.email,
                avatarUrl: resolveAvatarUrl(subUser.avatar_url)
              });
              setIsInitialized(true);
              return;
            }
          }
          
          console.log('❌ Authenticated user not found in profiles or sub_users');
        }
        
        // No valid user found
        console.log('❌ No valid user identity found');
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          setIsInitialized(true);
        }
        
      } catch (error) {
        console.error('❌ Error initializing chat:', error);
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          setIsInitialized(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, user?.email, shouldShowChat, location.pathname, isOnPublicBoard]);

  // ❌ REMOVED: Old normalization logic is no longer needed since the migration handles it

  // Check for sub-users (always allow chat to show)
  useEffect(() => {
    if (boardOwnerId) {
      supabase
        .from("sub_users")
        .select("id")
        .eq("board_owner_id", boardOwnerId)
        .limit(1)
        .then(({ data }) => {
          setHasSubUsers((data?.length || 0) > 0);
        });
    } else {
      setHasSubUsers(false);
    }
  }, [boardOwnerId]);

  // Start DM with proper peer-to-peer logic (no admin interference)
  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!boardOwnerId || !me) {
      console.log('❌ Cannot start DM - missing prerequisites');
      return;
    }

    console.log('🔄 Starting PEER-TO-PEER DM:', { me, otherId, otherType, boardOwnerId });
    
    try {
      setIsOpen(true);
      
      // Check if DM already exists between these TWO participants only
      const { data: existingChannels } = await supabase
        .from('chat_channels')
        .select(`
          id, 
          name, 
          is_dm,
          participants,
          chat_participants(user_id, sub_user_id, user_type)
        `)
        .eq('owner_id', boardOwnerId)
        .eq('is_dm', true);
      
      console.log('🔍 Checking existing DM channels for PEER-TO-PEER match:', existingChannels);
      
      for (const ch of (existingChannels || [])) {
        const participants = ch.chat_participants as any[];
        console.log('🔍 Checking channel participants:', { channelId: ch.id, participants, totalCount: participants.length });
        
        // For peer-to-peer DMs, we want EXACTLY 2 participants
        if (participants.length !== 2) {
          console.log('⏭️ Skipping channel - not exactly 2 participants');
          continue;
        }
        
        const hasMe = me.type === 'admin' 
          ? participants.some(p => p.user_id === me.id && p.user_type === 'admin')
          : participants.some(p => p.sub_user_id === me.id && p.user_type === 'sub_user');
        
        const hasOther = otherType === 'admin'
          ? participants.some(p => p.user_id === otherId && p.user_type === 'admin')
          : participants.some(p => p.sub_user_id === otherId && p.user_type === 'sub_user');
        
        if (hasMe && hasOther) {
          console.log('✅ Found existing PEER-TO-PEER DM channel:', ch.id);
          setCurrentChannelId(ch.id);
          return;
        }
      }
      
      // No existing DM found, create new PEER-TO-PEER DM
      console.log('🔧 Creating new PEER-TO-PEER DM channel...');
      
      const isPublicBoard = location.pathname.startsWith('/board/');
      
      if (isPublicBoard && me.type === 'sub_user') {
        console.log('🔧 PUBLIC BOARD: Creating PEER-TO-PEER DM via RPC for sub-user...');
        
        const slug = location.pathname.split('/').pop()!;
        const stored = JSON.parse(localStorage.getItem(`public-board-access-${slug}`) || '{}');
        const senderEmail = me.email || stored?.email;
        
        if (!senderEmail) {
          console.error('❌ Missing sub-user email for public board DM');
          return;
        }
        
        const { data: dmId, error } = await supabase.rpc('start_public_board_dm', {
          p_board_owner_id: boardOwnerId,
          p_sender_email: senderEmail,
          p_other_id: otherId,
          p_other_type: otherType
        });
        
        if (error) {
          console.error('❌ Error creating public board DM:', error);
          return;
        }
        
        console.log('✅ Created public board PEER-TO-PEER DM:', dmId);
        setCurrentChannelId(dmId);
        return;
      }
      
      // Dashboard/authenticated PEER-TO-PEER DM creation
      console.log('🔧 DASHBOARD: Creating PEER-TO-PEER DM channel via direct API...');
      
      const { data: newChannel, error: channelError } = await supabase
        .from('chat_channels')
        .insert({
          owner_id: boardOwnerId,
          name: 'Direct Message',
          emoji: '💬',
          is_dm: true,
          is_private: true,
          participants: JSON.stringify([me.id, otherId]) // Store as JSON for consistency
        })
        .select()
        .single();
      
      if (channelError) {
        console.error('❌ Error creating DM channel:', channelError);
        return;
      }
      
      console.log('✅ Created PEER-TO-PEER DM channel:', newChannel);
      
      // Add ONLY the two participants (no board owner unless they're one of the participants)
      const participantInserts = [
        {
          channel_id: newChannel.id,
          user_id: me.type === 'admin' ? me.id : null,
          sub_user_id: me.type === 'sub_user' ? me.id : null,
          user_type: me.type
        },
        {
          channel_id: newChannel.id,
          user_id: otherType === 'admin' ? otherId : null,
          sub_user_id: otherType === 'sub_user' ? otherId : null,
          user_type: otherType
        }
      ];
      
      console.log('🔧 Adding PEER-TO-PEER participants:', participantInserts);
      
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert(participantInserts);
      
      if (participantsError) {
        console.warn('⚠️ Error adding participants (might already exist):', participantsError);
      }
      
      console.log('✅ PEER-TO-PEER DM setup complete, opening channel:', newChannel.id);
      setCurrentChannelId(newChannel.id);
      
    } catch (error) {
      console.error('❌ Error starting DM:', error);
      toast({
        title: "Error",
        description: "Failed to start direct message",
        variant: "destructive"
      });
    }
  }, [boardOwnerId, me, location.pathname, toast]);

  // Context value - memoized to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isOpen,
    open,
    close,
    toggle,
    isInitialized,
    hasSubUsers,
    me,
    currentChannelId,
    setCurrentChannelId,
    openChannel,
    startDM,
    unreadTotal,
    channelUnreads,
    boardOwnerId,
    connectionStatus,
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, currentChannelId, openChannel, startDM, unreadTotal, channelUnreads, boardOwnerId, connectionStatus]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
      {shouldShowChat && portalRoot && createPortal(
        <>
          {!isOpen && (
            <ChatIcon 
              onClick={toggle} 
              isOpen={isOpen} 
              unreadCount={unreadTotal}
            />
          )}
          {isOpen && (
            <ChatWindow isOpen={isOpen} onClose={close} />
          )}
        </>,
        portalRoot
      )}
    </ChatContext.Provider>
  );
};