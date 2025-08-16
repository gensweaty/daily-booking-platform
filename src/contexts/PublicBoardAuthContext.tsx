import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface PublicBoardUser {
  id: string;
  email: string;
  fullName: string;
  boardOwnerId: string;
}

interface PublicBoardAuthContextType {
  user: PublicBoardUser | null;
  isPublicBoard: boolean;
  loading: boolean;
}

const PublicBoardAuthContext = createContext<PublicBoardAuthContextType>({
  user: null,
  isPublicBoard: false,
  loading: true,
});

export const usePublicBoardAuth = () => {
  const context = useContext(PublicBoardAuthContext);
  if (!context) {
    throw new Error('usePublicBoardAuth must be used within a PublicBoardAuthProvider');
  }
  return context;
};

export const PublicBoardAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { slug } = useParams<{ slug: string }>();
  const [user, setUser] = useState<PublicBoardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPublicBoard, setIsPublicBoard] = useState(false);

  useEffect(() => {
      const checkPublicBoardAuth = () => {
        // Check if we're on a public board route
        const isOnPublicBoard = !!slug && window.location.pathname.includes(`/board/${slug}`);
        setIsPublicBoard(isOnPublicBoard);
        
        console.log('🔍 PublicBoardAuth: Checking auth, isOnPublicBoard:', isOnPublicBoard, 'slug:', slug, 'path:', window.location.pathname);

        if (isOnPublicBoard && slug) {
          // Check for existing public board access token
          const storedData = localStorage.getItem(`public-board-access-${slug}`);
          console.log('🔍 PublicBoardAuth: Stored data exists:', !!storedData);
          
          if (storedData) {
            try {
              const parsedData = JSON.parse(storedData);
              const { fullName, email, timestamp, boardOwnerId } = parsedData;
              
              // Check if token is not expired (3 hours)
              const threeHoursInMs = 3 * 60 * 60 * 1000;
              const isExpired = Date.now() - timestamp > threeHoursInMs;
              
              console.log('🔍 PublicBoardAuth: Token data:', { fullName, email, boardOwnerId, isExpired });
              
              if (!isExpired && fullName && email && boardOwnerId) {
                // Create a mock user for the chat system
                const publicUser = {
                  id: `public-${email}-${boardOwnerId}`, // Generate a consistent ID
                  email,
                  fullName,
                  boardOwnerId
                };
                setUser(publicUser);
                console.log('🔍 PublicBoardAuth: Set user from stored data:', publicUser);
              } else {
                setUser(null);
                console.log('🔍 PublicBoardAuth: Token expired or incomplete');
              }
            } catch (error) {
              console.error('Error parsing public board auth data:', error);
              setUser(null);
            }
          } else {
            setUser(null);
            console.log('🔍 PublicBoardAuth: No stored access token');
          }
        } else {
          setUser(null);
          console.log('🔍 PublicBoardAuth: Not on public board');
        }
        
        setLoading(false);
      };

    checkPublicBoardAuth();

    // Listen for localStorage changes (when user logs in/out on public board)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `public-board-access-${slug}`) {
        checkPublicBoardAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for manual localStorage updates within the same tab
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, [key, value]);
      if (key === `public-board-access-${slug}`) {
        setTimeout(checkPublicBoardAuth, 100); // Small delay to ensure data is set
      }
    };

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      localStorage.setItem = originalSetItem;
    };
  }, [slug]);

  const value = {
    user,
    isPublicBoard,
    loading,
  };

  return (
    <PublicBoardAuthContext.Provider value={value}>
      {children}
    </PublicBoardAuthContext.Provider>
  );
};