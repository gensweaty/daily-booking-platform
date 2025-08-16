import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { ChatIcon } from './ChatIcon';
import { ChatWindow } from './ChatWindow';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicBoardAuth } from '@/contexts/PublicBoardAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createPortal } from 'react-dom';

type ChatContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isInitialized: boolean;
  hasSubUsers: boolean;
  userId?: string | null;
};

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
};

export const ChatProvider = () => {
  const { user: internalUser } = useAuth();
  const { user: externalUser, isPublicBoard } = usePublicBoardAuth();
  
  // Use the appropriate user based on context
  const effectiveUser = isPublicBoard ? externalUser : internalUser;
  const userId = effectiveUser?.id ?? null;
  const boardOwnerId = isPublicBoard ? externalUser?.boardOwnerId : internalUser?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasSubUsers, setHasSubUsers] = useState(false);

  // Enhanced debug logging
  console.log('🔍 ChatProvider Debug:', {
    internalUser: !!internalUser,
    internalUserId: internalUser?.id,
    externalUser: !!externalUser,
    externalUserId: externalUser?.id,
    externalBoardOwnerId: externalUser?.boardOwnerId,
    isPublicBoard,
    effectiveUser: !!effectiveUser,
    effectiveUserId: effectiveUser?.id,
    boardOwnerId,
    hasSubUsers,
    isInitialized,
    currentPath: window.location.pathname
  });

  // Initialize: check if this user has sub-users
  useEffect(() => {
    let cancelled = false;
    
    const initializeChat = async () => {
      try {
        // If no board owner ID, we can't init yet
        if (!boardOwnerId) {
          console.log('⏳ No board owner ID, marking as initialized with no sub-users');
          setHasSubUsers(false);
          setIsInitialized(true);
          return;
        }

        console.log('🔍 Checking sub-users for board owner:', boardOwnerId);

        const { data, error } = await supabase
          .from('sub_users')
          .select('id, fullname, email')
          .eq('board_owner_id', boardOwnerId);

        if (!cancelled) {
          if (error) {
            console.error('[ChatProvider] sub_users query error:', error);
            setHasSubUsers(false);
          } else {
            const subUserCount = data?.length ?? 0;
            console.log('✅ Found', subUserCount, 'sub-users for board owner:', boardOwnerId);
            setHasSubUsers(subUserCount > 0);
          }
          setIsInitialized(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[ChatProvider] init error:', e);
          setHasSubUsers(false);
          setIsInitialized(true);
        }
      }
    };

    setIsInitialized(false);
    initializeChat();
    
    return () => { 
      cancelled = true; 
    };
  }, [boardOwnerId]);

  const contextValue = useMemo<ChatContextType>(() => ({
    isOpen,
    open: () => {
      console.log('🖱️ Opening chat');
      setIsOpen(true);
    },
    close: () => {
      console.log('🔒 Closing chat');
      setIsOpen(false);
    },
    toggle: () => {
      console.log('🔄 Toggling chat, current state:', isOpen);
      setIsOpen(prev => !prev);
    },
    isInitialized,
    hasSubUsers,
    userId,
  }), [isOpen, isInitialized, hasSubUsers, userId]);

  // Wait for initialization before deciding whether to show chat
  if (!isInitialized) {
    console.log('⏳ Chat not initialized yet, waiting...');
    return null;
  }

  // Only show chat if user has sub-users
  if (!hasSubUsers) {
    console.log('❌ Chat not showing: no sub-users found');
    return null;
  }

  console.log('✅ Chat should be visible - rendering icon and window');

  // Render to portal to avoid z-index issues
  return (
    <ChatContext.Provider value={contextValue}>
      {createPortal(
        <>
          <ChatIcon
            onClick={contextValue.toggle}
            isOpen={isOpen}
            unreadCount={0}
          />
          <ChatWindow
            isOpen={isOpen}
            onClose={contextValue.close}
          />
        </>,
        document.body
      )}
    </ChatContext.Provider>
  );
};