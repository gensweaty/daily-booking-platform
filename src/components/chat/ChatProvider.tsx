import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicBoardAuth } from "@/contexts/PublicBoardAuthContext";
import { ChatIcon } from "./ChatIcon";
import { ChatWindow } from "./ChatWindow";
import { resolveAvatarUrl } from "./_avatar";
import { useToast } from "@/hooks/use-toast";

type Me = { id: string; type: "admin" | "sub_user"; name: string; avatarUrl?: string };

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
  boardOwnerId: string | null;
};

const ChatContext = createContext<ChatCtx | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};

export const ChatProvider: React.FC = () => {
  const { user } = useAuth();
  const { user: publicBoardUser, isPublicBoard } = usePublicBoardAuth();
  const location = useLocation();
  const { toast } = useToast();
  
  // Determine effective user and board owner
  const effectiveUser = isPublicBoard ? publicBoardUser : user;
  const isOnPublicBoard = location.pathname.startsWith('/board/');
  const isOnDashboard = location.pathname.includes('/dashboard');
  
  // Should we show chat at all?
  const shouldShowChat = useMemo(() => {
    // Show on dashboard when user is present
    if (isOnDashboard && user) {
      console.log('✅ Dashboard + user -> show chat');
      return true;
    }
    
    // Show on public board (even without user, for external access)
    if (isOnPublicBoard) {
      console.log('✅ Public board -> show chat');
      return true;
    }
    
    console.log('❌ No conditions met -> hide chat', { isOnDashboard, isOnPublicBoard, hasUser: !!user });
    return false;
  }, [location.pathname, user, isOnDashboard, isOnPublicBoard]);

  // UI state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasSubUsers, setHasSubUsers] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [boardOwnerId, setBoardOwnerId] = useState<string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Create portal root
  const portalRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let node = document.getElementById("chat-root") as HTMLElement | null;
    if (!node) {
      node = document.createElement("div");
      node.id = "chat-root";
      node.style.position = "fixed";
      node.style.inset = "0";
      node.style.pointerEvents = "none";
      node.style.zIndex = "2147483647";
      document.body.appendChild(node);
    }
    portalRef.current = node;
  }, []);

  // Chat controls
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  // Initialize user identity and board owner
  useEffect(() => {
    let active = true;
    
    (async () => {
      console.log('🔍 Initializing chat for:', { 
        user: user?.email, 
        isPublicBoard, 
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
        
        // Handle authenticated users (admin and sub-users)
        if (user?.id) {
          console.log('🔍 Checking authenticated user:', user.email);
          
          // Try admin first - check profiles table
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          
          if (profileError) {
            console.log('⚠️ Profile query error:', profileError);
          }
          
          if (active && profile) {
            console.log('✅ Admin user detected:', profile.username);
            setBoardOwnerId(user.id);
            setMe({
              id: profile.id,
              type: "admin",
              name: profile.username || "Admin",
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

  // Channel management
  const openChannel = useCallback((id: string) => {
    console.log('📂 Opening channel:', id);
    setCurrentChannelId(id);
    setUnreadTotal(0);
  }, []);

  const startDM = useCallback(async (otherId: string, otherType: "admin" | "sub_user") => {
    if (!me || !boardOwnerId) {
      console.log('❌ Missing me or boardOwnerId for DM:', { me, boardOwnerId });
      return;
    }
    
    console.log('🚀 Starting DM with:', { otherId, otherType, me, boardOwnerId });
    
    try {
      // Simple DM name
      const dmName = `DM: ${me.name} & ${otherType === 'admin' ? 'Admin' : 'Member'}`;

      // Look for existing DM channel
      const { data: existing } = await supabase
        .from("chat_channels")
        .select("id, participants")
        .eq("is_dm", true)
        .eq("owner_id", boardOwnerId);

      // Find existing DM with these participants
      let channelId = existing?.find(ch => {
        const participants = ch.participants as string[];
        return participants?.includes(me.id) && participants?.includes(otherId);
      })?.id;
      
      if (!channelId) {
        console.log('🆕 Creating new DM channel');
        const { data: created, error } = await supabase
          .from("chat_channels")
          .insert({
            is_dm: true,
            participants: [me.id, otherId],
            name: dmName,
            owner_id: boardOwnerId
          })
          .select("id")
          .single();
        
        if (error) {
          console.error('❌ Error creating DM channel:', error);
          toast({
            title: "Error",
            description: "Failed to start direct message",
            variant: "destructive"
          });
          return;
        }
        
        // Create participant entries
        if (created?.id) {
          await supabase.from("chat_participants").insert([
            {
              channel_id: created.id,
              user_id: me.type === 'admin' ? me.id : null,
              sub_user_id: me.type === 'sub_user' ? me.id : null,
              user_type: me.type
            },
            {
              channel_id: created.id,
              user_id: otherType === 'admin' ? otherId : null,
              sub_user_id: otherType === 'sub_user' ? otherId : null,
              user_type: otherType
            }
          ]);
        }
        
        channelId = created?.id;
        console.log('✅ New DM channel created:', channelId);
      }

      if (channelId) {
        openChannel(channelId);
        if (!isOpen) open();
      }
    } catch (error) {
      console.error('❌ Failed to start DM:', error);
      toast({
        title: "Error",
        description: "Failed to start direct message",
        variant: "destructive"
      });
    }
  }, [me, boardOwnerId, openChannel, isOpen, open, toast]);

  // Enhanced notifications with improved message matching
  useEffect(() => {
    if (!me || !boardOwnerId || !shouldShowChat) {
      console.log('🔔 Skipping notifications setup - missing data:', { 
        hasMe: !!me, 
        hasBoardOwner: !!boardOwnerId, 
        shouldShow: shouldShowChat 
      });
      return;
    }

    console.log('🔔 Setting up notifications for:', { 
      userName: me.name, 
      userType: me.type, 
      userId: me.id,
      boardOwnerId 
    });

    const ch = supabase
      .channel(`chat_notifications_${me.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as any;
          console.log('📨 New message received:', { 
            content: msg.content?.slice(0, 30) + '...', 
            senderName: msg.sender_name,
            senderType: msg.sender_type,
            senderUserId: msg.sender_user_id,
            senderSubUserId: msg.sender_sub_user_id,
            ownerId: msg.owner_id,
            expectedOwnerId: boardOwnerId,
            channelId: msg.channel_id,
            currentChannelId
          });

          // Only process messages for this board
          if (msg.owner_id !== boardOwnerId) {
            console.log('⏭️ Skipping message - owner mismatch:', { 
              msgOwnerId: msg.owner_id, 
              expectedOwnerId: boardOwnerId 
            });
            return;
          }

          // Enhanced message ownership detection - only use database IDs
          const isMine = (
            // Admin user match (exact ID match)
            (me.type === 'admin' && msg.sender_type === 'admin' && msg.sender_user_id === me.id) ||
            // Sub-user match (exact ID match)
            (me.type === 'sub_user' && msg.sender_type === 'sub_user' && msg.sender_sub_user_id === me.id)
          );
          
          const isActiveChannel = (msg.channel_id === currentChannelId);
          const shouldCount = !isMine && (!isActiveChannel || !isOpen);
          const shouldNotify = !isMine && (!isOpen || !isActiveChannel);

          console.log('🔍 Enhanced message analysis:', { 
            isMine, 
            isActiveChannel, 
            shouldCount, 
            shouldNotify,
            chatOpen: isOpen,
            currentUser: {
              id: me.id,
              type: me.type,
              name: me.name
            },
            messageFromSender: {
              userId: msg.sender_user_id,
              subUserId: msg.sender_sub_user_id,
              type: msg.sender_type,
              name: msg.sender_name
            },
            matchingLogic: {
              adminMatch: me.type === 'admin' && msg.sender_type === 'admin' && msg.sender_user_id === me.id,
              subUserMatch: me.type === 'sub_user' && msg.sender_type === 'sub_user' && msg.sender_sub_user_id === me.id
            }
          });

          if (shouldCount) {
            setUnreadTotal(prev => {
              const newCount = prev + 1;
              console.log('📈 Updating unread count:', prev, '->', newCount);
              return newCount;
            });
          }

          // Enhanced notification display
          if (shouldNotify && "Notification" in window && Notification.permission === "granted") {
            console.log('🔔 Showing browser notification from:', msg.sender_name);
            try {
              const notification = new Notification(msg.sender_name || "New message", { 
                body: String(msg.content || '').slice(0, 120),
                icon: '/favicon.ico',
                tag: `chat-${msg.channel_id}`, // Prevent duplicate notifications
                requireInteraction: false,
                silent: false
              });
              
              // Auto-close notification after 5 seconds
              setTimeout(() => {
                notification.close();
              }, 5000);
              
            } catch (notifError) {
              console.error('❌ Failed to show notification:', notifError);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up notification listener for:', me.name);
      supabase.removeChannel(ch);
    };
  }, [me?.id, me?.type, me?.name, boardOwnerId, currentChannelId, isOpen, shouldShowChat]);

  // Reset unread on open/channel change
  useEffect(() => {
    if (isOpen || currentChannelId) {
      setUnreadTotal(0);
    }
  }, [isOpen, currentChannelId]);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const value = useMemo<ChatCtx>(() => ({
    isOpen, open, close, toggle, isInitialized, hasSubUsers, me,
    currentChannelId, setCurrentChannelId, openChannel, startDM, 
    unreadTotal, boardOwnerId
  }), [isOpen, open, close, toggle, isInitialized, hasSubUsers, me, 
       currentChannelId, openChannel, startDM, unreadTotal, boardOwnerId]);

  if (!shouldShowChat || !portalRef.current) return null;

  console.log('🔍 ChatProvider render:', { 
    hasSubUsers, isInitialized, hasUser: !!user?.id, shouldShowChat,
    me, boardOwnerId
  });

  return (
    <ChatContext.Provider value={value}>
      {createPortal(
        <>
          {isInitialized && !isOpen && (
            <div style={{ pointerEvents: "auto" }}>
              <ChatIcon onClick={toggle} isOpen={isOpen} unreadCount={unreadTotal} />
            </div>
          )}

          {isOpen && (
            <div style={{ pointerEvents: "auto" }}>
              <ChatWindow isOpen={isOpen} onClose={close} />
            </div>
          )}
        </>,
        portalRef.current
      )}
    </ChatContext.Provider>
  );
};