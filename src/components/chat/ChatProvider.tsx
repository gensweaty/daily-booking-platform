import { useState } from 'react';
import { ChatIcon } from './ChatIcon';
import { ChatWindow } from './ChatWindow';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicBoardAuth } from '@/contexts/PublicBoardAuthContext';

export const ChatProvider = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { user } = useAuth();
  const { user: publicBoardUser, isPublicBoard } = usePublicBoardAuth();
  const chat = useChat();

  // Determine the effective user (either regular auth or public board auth)
  const effectiveUser = isPublicBoard ? publicBoardUser : user;

  // Enhanced debug logging with actual values
  console.log('🔍 ChatProvider Debug:', {
    regularUser: !!user,
    regularUserId: user?.id,
    publicBoardUser: !!publicBoardUser,
    publicBoardUserId: publicBoardUser?.id,
    publicBoardUserEmail: publicBoardUser?.email,
    isPublicBoard,
    effectiveUser: !!effectiveUser,
    effectiveUserId: effectiveUser?.id,
    effectiveUserEmail: effectiveUser?.email,
    hasSubUsers: chat.hasSubUsers,
    isInitialized: chat.isInitialized,
    isLoading: chat.loading,
    subUsersCount: chat.subUsers?.length || 0,
    channelsCount: chat.channels?.length || 0,
    currentPath: window.location.pathname,
    subUsers: chat.subUsers?.map(su => ({ id: su.id, email: su.email, fullname: su.fullname })) || []
  });

  // Wait for initialization before deciding whether to show chat
  if (!chat.isInitialized) {
    console.log('⏳ Chat not initialized yet, waiting...');
    return null;
  }

  // Only show chat if user is authenticated and has sub-users
  if (!effectiveUser || !chat.hasSubUsers) {
    console.log('❌ Chat not showing:', { 
      effectiveUser: !!effectiveUser, 
      hasSubUsers: chat.hasSubUsers, 
      subUsersCount: chat.subUsers?.length || 0,
      reason: !effectiveUser ? 'no effective user' : 'no sub-users',
      isPublicBoard,
      regularUser: !!user,
      publicBoardUser: !!publicBoardUser,
      currentPath: window.location.pathname
    });
    return null;
  }

  console.log('✅ Chat should be visible now - effective user has', chat.subUsers?.length || 0, 'sub-users');

  const handleChatClick = () => {
    console.log('🖱️ Chat icon clicked, current state:', isChatOpen, 'toggling to:', !isChatOpen);
    setIsChatOpen(!isChatOpen);
  };

  console.log('🎯 ChatProvider rendering components:', { 
    showingIcon: true, 
    iconProps: { isOpen: isChatOpen, unreadCount: 0 },
    windowProps: { isOpen: isChatOpen }
  });

  return (
    <>
      <ChatIcon
        onClick={handleChatClick}
        isOpen={isChatOpen}
        unreadCount={0} // TODO: Implement unread count logic
      />
      
      <ChatWindow
        isOpen={isChatOpen}
        onClose={() => {
          console.log('🔒 Closing chat window');
          setIsChatOpen(false);
        }}
      />
    </>
  );
};