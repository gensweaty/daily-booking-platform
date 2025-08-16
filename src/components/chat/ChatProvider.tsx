import { useState } from 'react';
import { ChatIcon } from './ChatIcon';
import { ChatWindow } from './ChatWindow';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';

export const ChatProvider = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { user } = useAuth();
  const chat = useChat();

  // Only show chat if user is authenticated and has sub-users
  if (!user || !chat.hasSubUsers) {
    return null;
  }

  return (
    <>
      <ChatIcon
        onClick={() => setIsChatOpen(!isChatOpen)}
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