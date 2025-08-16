import { useState } from 'react';
import { ChatIcon } from './ChatIcon';
import { ChatWindow } from './ChatWindow';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';

export const ChatProvider = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { user } = useAuth();
  const chat = useChat();

  // Debug logging
  console.log('🔍 ChatProvider Debug:', {
    user: !!user,
    hasSubUsers: chat.hasSubUsers,
    isLoading: chat.loading,
    subUsersCount: chat.subUsers.length,
    channels: chat.channels.length
  });

  // Only show chat if user is authenticated and has sub-users
  if (!user || !chat.hasSubUsers) {
    console.log('❌ Chat not showing:', { user: !!user, hasSubUsers: chat.hasSubUsers });
    return null;
  }

  console.log('✅ Chat should be visible now');

  const handleChatClick = () => {
    console.log('🖱️ Chat icon clicked, current state:', isChatOpen);
    setIsChatOpen(!isChatOpen);
  };

  return (
    <>
      <ChatIcon
        onClick={handleChatClick}
        isOpen={isChatOpen}
        unreadCount={0} // TODO: Implement unread count logic
      />
      
      <ChatWindow
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </>
  );
};