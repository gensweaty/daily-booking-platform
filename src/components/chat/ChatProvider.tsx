import { useState } from 'react';
import { ChatIcon } from './ChatIcon';
import { ChatWindow } from './ChatWindow';
import { useChat } from '@/hooks/useChat';

export const ChatProvider = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chat = useChat();

  // Only show chat if user has sub-users
  if (!chat.hasSubUsers) {
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