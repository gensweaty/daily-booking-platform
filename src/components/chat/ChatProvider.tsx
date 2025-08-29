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
  const isOnDashboard = location.pathname.startsWith('/dashboard'); // Fix: Support all dashboard routes
  const effectiveUser = isOnPublicBoard ? publicBoardUser : user;

  // Determine if chat should be shown - FIXED: prioritize sub-user context on public boards
  const shouldShowChat = useMemo(() => {
    // If on public board with sub-user context, always show chat
    if (isOnPublicBoard && publicBoardUser?.id) return true;
    // Show chat for authenticated users (admin) when NOT in sub-user context
    if (user?.id && (!isOnPublicBoard || !publicBoardUser?.id)) return true;
    // Show chat on public boards as fallback
    return isOnPublicBoard;
  }, [user?.id, isOnPublicBoard, publicBoardUser?.id]);

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
      // Increment unread count for channel with message timestamp
      incrementUnread(message.channel_id, message.created_at);

      // FIXED: Only show notifications to the intended recipient
      const shouldShowNotification = () => {
        // Skip notifications if chat is open and viewing the same channel
        if (isOpen && currentChannelId === message.channel_id) {
          return false;
        }

        // For DM channels (start with 'dm_'), check if I'm one of the participants
        if (message.channel_id.startsWith('dm_')) {
          const [, user1Id, user1Type, user2Id, user2Type] = message.channel_id.split('_');
          const isParticipant = (me?.id === user1Id && me?.type === user1Type) || 
                               (me?.id === user2Id && me?.type === user2Type);
          
          console.log('🔔 DM notification check:', {
            channelId: message.channel_id,
            myId: me?.id,
            myType: me?.type,
            isParticipant,
            user1: `${user1Id}_${user1Type}`,
            user2: `${user2Id}_${user2Type}`
          });
          
          return isParticipant;
        }

        // For regular channels, show notification if I'm not the sender
        return true;
      };

      if (shouldShowNotification()) {
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

    // Direct message broadcasting (will be handled by cache in ChatArea)
    window.dispatchEvent(new CustomEvent('chat-message-received', {
      detail: { message }
    }));
  }, [boardOwnerId, me, isOpen, currentChannelId, incrementUnread, showNotification]);

  // Real-time setup - FIXED: enable for authenticated users regardless of route
  const { connectionStatus } = useEnhancedRealtimeChat({
    onNewMessage: handleNewMessage,
    userId: me?.id,
    boardOwnerId: boardOwnerId || undefined,
    // Enable real-time for authenticated users, disable for public board access only
    enabled: shouldShowChat && isInitialized && !!boardOwnerId && !!user?.id,
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

  // Initialize user identity and board owner - ENHANCED with loading states and timeout
  useEffect(() => {
    let active = true;
    let initTimeout: NodeJS.Timeout;
    
    (async () => {
      console.log('🔍 Initializing chat for:', { 
        user: user?.email, 
        userId: user?.id,
        shouldShowChat, 
        path: location.pathname,
        isOnPublicBoard,
        effectiveUser: effectiveUser?.email,
        publicBoardUser: publicBoardUser?.email,
        publicBoardUserLoading: publicBoardUser === undefined
      });
      
      // Set loading state initially
      setIsInitialized(false);
      
      // Timeout to prevent infinite loading
      initTimeout = setTimeout(() => {
        if (active) {
          console.log('⚠️ ChatProvider: Initialization timeout - forcing completion');
          setIsInitialized(true);
        }
      }, 8000);
      
      if (!shouldShowChat) {
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          clearTimeout(initTimeout);
          setIsInitialized(true);
        }
        return;
      }

      // Fixed: Simplified auth wait - no broken polling mechanism
      if (isOnPublicBoard && publicBoardUser === undefined) {
        console.log('⏳ Public board auth not ready yet, initializing anyway to prevent infinite loading');
        // Don't wait - let the initialization proceed and handle auth later
      }

      try {
        // SURGICAL FIX 1: Always resolve board owner from URL slug first
        if (isOnPublicBoard) {
          const slug = location.pathname.split('/').pop()!;
          const { data: pb } = await supabase
            .from('public_boards')
            .select('user_id')
            .eq('slug', slug)
            .maybeSingle();

          if (pb?.user_id) {
            // Set board owner IMMEDIATELY so the rest of chat can proceed
            if (active) setBoardOwnerId(pb.user_id);
            console.log('✅ Board owner resolved from slug:', pb.user_id);
            
            // Now determine "who am I"
            // If there's a Supabase session with an email → look up in sub_users
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.email) {
              console.log('🔍 Looking up authenticated user in sub_users table');
              const { data: subUser } = await supabase
                .from("sub_users")
                .select("id, fullname, avatar_url, email")
                .eq("board_owner_id", pb.user_id)
                .ilike("email", session.user.email.trim().toLowerCase())
                .maybeSingle();
              
              if (subUser?.id) {
                const subUserIdentity = {
                  id: subUser.id,
                  type: "sub_user" as const, 
                  name: subUser.fullname || session.user.email.split('@')[0],
                  email: session.user.email,
                  avatarUrl: resolveAvatarUrl(subUser.avatar_url)
                };
                
                console.log('🎉 SUCCESS: Using authenticated sub-user identity:', subUserIdentity);
                
                if (active) {
                  setMe(subUserIdentity);
                  clearTimeout(initTimeout);
                  setIsInitialized(true);
                }
                return;
              }
            }
            
            // Fallback to localStorage token flow
            const storedData = localStorage.getItem(`public-board-access-${slug}`);
            if (storedData) {
              try {
                const parsedData = JSON.parse(storedData);
                const { fullName: storedFullName, email: storedEmail } = parsedData;
                
                if (storedFullName && storedEmail) {
                  // Try to find the sub-user record
                  const { data: subUser } = await supabase
                    .from("sub_users")
                    .select("id, fullname, avatar_url, email")
                    .eq("board_owner_id", pb.user_id)
                    .ilike("email", storedEmail.trim().toLowerCase())
                    .maybeSingle();
                  
                  if (subUser?.id) {
                    const subUserIdentity = {
                      id: subUser.id,
                      type: "sub_user" as const, 
                      name: subUser.fullname || storedFullName,
                      email: storedEmail,
                      avatarUrl: resolveAvatarUrl(subUser.avatar_url)
                    };
                    
                    console.log('🎉 SUCCESS: Using localStorage sub-user identity:', subUserIdentity);
                    
                    if (active) {
                      setMe(subUserIdentity);
                      clearTimeout(initTimeout);
                      setIsInitialized(true);
                    }
                    return;
                  }
                }
              } catch (error) {
                console.error('❌ Error using localStorage context:', error);
              }
            }
          }
        }
        
        // Handle regular PUBLIC BOARD ACCESS (guests without authentication)
        if (isOnPublicBoard && !publicBoardUser?.id) {
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
                    clearTimeout(initTimeout);
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
                    clearTimeout(initTimeout);
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
        
        // Handle authenticated users (admin and sub-users) - PRIORITY: Check authenticated users first
        if (user?.id) {
          console.log('🔍 Checking authenticated user:', { 
            email: user.email, 
            userId: user.id,
            path: location.pathname 
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
            console.log('✅ AUTHENTICATED ADMIN detected:', profile.username);
            
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
            clearTimeout(initTimeout);
            setIsInitialized(true);
            console.log('🎉 AUTHENTICATED ADMIN: Chat initialized with full features');
            return;
          }
          
          // Try sub-user by email match (case-insensitive)
          const userEmail = user.email?.toLowerCase();
          if (userEmail) {
            console.log('🔍 Looking for authenticated sub-user with email:', userEmail);
            
            const { data: subUser, error: subUserError } = await supabase
              .from("sub_users")
              .select("*")
              .ilike("email", userEmail)
              .maybeSingle();

            if (subUserError) {
              console.log('⚠️ Sub-user query error:', subUserError);
            }

            if (active && subUser) {
              console.log('✅ AUTHENTICATED SUB-USER detected:', { 
                id: subUser.id,
                fullname: subUser.fullname, 
                email: subUser.email,
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
              clearTimeout(initTimeout);
              setIsInitialized(true);
              console.log('🎉 AUTHENTICATED SUB-USER: Chat initialized with full features');
              return;
            }
          }
          
          console.log('❌ Authenticated user not found in profiles or sub_users - this should not happen for valid accounts');
        }
        
        // No valid user found
        console.log('❌ No valid user identity found');
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          clearTimeout(initTimeout);
          setIsInitialized(true);
        }
        
      } catch (error) {
        console.error('❌ Error initializing chat:', error);
        if (active) {
          setMe(null);
          setBoardOwnerId(null);
          clearTimeout(initTimeout);
          setIsInitialized(true);
        }
      }
    })();

    return () => { 
      active = false;
      if (initTimeout) clearTimeout(initTimeout);
    };
  }, [user?.id, user?.email, shouldShowChat, location.pathname, isOnPublicBoard, publicBoardUser]);

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

  // C.5 Replace both DM creators with the canonical RPC
  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!boardOwnerId || !me) {
      console.log('❌ Cannot start DM - missing prerequisites');
      return;
    }

    try {
      console.log('🔍 Using canonical find_or_create_dm RPC for:', { me, otherId, otherType });

      // Single canonical path for both dashboard and public boards
      const { data: channelId, error } = await supabase.rpc('find_or_create_dm', {
        p_owner_id: boardOwnerId,
        p_a_type: me.type,
        p_a_id: me.id,
        p_b_type: otherType,
        p_b_id: otherId
      });

      if (error) {
        console.error('❌ find_or_create_dm RPC failed:', error);
        toast({
          title: 'Error',
          description: 'Failed to start DM. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      console.log('✅ Canonical DM channel created/found:', channelId);
      setCurrentChannelId(channelId as string);
      setIsOpen(true);

    } catch (error: any) {
      console.error('❌ Error in startDM:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start direct message',
        variant: 'destructive',
      });
    }
  }, [boardOwnerId, me, toast]);

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