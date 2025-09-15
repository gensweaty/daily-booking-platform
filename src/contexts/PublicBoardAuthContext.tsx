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
          console.log('🔍 PublicBoardAuth: Setting loading true for authentication check');
          setLoading(true);
          
          // Add timeout to prevent infinite loading
          const authTimeout = setTimeout(() => {
            console.log('⚠️ PublicBoardAuth: Authentication timeout - fallback to guest access');
            setLoading(false);
          }, 5000);
          
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
                // Fetch the actual sub-user UUID from database
                console.log('🔍 PublicBoardAuth: Resolving sub-user UUID for email:', email);
                
                // Import supabase client dynamically to avoid circular dependencies
                import('@/integrations/supabase/client').then(({ supabase }) => {
                  supabase
                    .from('sub_users')
                    .select('id')
                    .eq('email', email)
                    .eq('board_owner_id', boardOwnerId)
                    .single()
                    .then(({ data: subUser, error }) => {
                      if (error || !subUser) {
                        console.error('❌ Failed to resolve sub-user UUID:', error);
                        setUser(null);
                        clearTimeout(authTimeout);
                        setLoading(false);
                        return;
                      }
                      
                      const publicUser = {
                        id: subUser.id, // Use actual database UUID
                        email,
                        fullName,
                        boardOwnerId
                      };
                      setUser(publicUser);
                      console.log('✅ PublicBoardAuth: Resolved sub-user UUID:', publicUser);
                      
                      // Clear timeout and complete authentication
                      clearTimeout(authTimeout);
                      setTimeout(() => {
                        setLoading(false);
                        console.log('🔍 PublicBoardAuth: Loading complete after UUID resolution');
                      }, 150);
                    });
                }).catch((importError) => {
                  console.error('Failed to import supabase client:', importError);
                  setUser(null);
                  clearTimeout(authTimeout);
                  setLoading(false);
                });
              } else {
                setUser(null);
                console.log('🔍 PublicBoardAuth: Token expired or incomplete');
                clearTimeout(authTimeout);
                setLoading(false);
              }
            } catch (error) {
              console.error('Error parsing public board auth data:', error);
              setUser(null);
              clearTimeout(authTimeout);
              setLoading(false);
            }
          } else {
            setUser(null);
            console.log('🔍 PublicBoardAuth: No stored access token');
            clearTimeout(authTimeout);
            setLoading(false);
          }
        } else {
          setUser(null);
          console.log('🔍 PublicBoardAuth: Not on public board');
          setLoading(false);
        }
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
        console.log('🔍 PublicBoardAuth: Immediate localStorage update detected');
        // Immediate check for faster response with delay to prevent race conditions
        setTimeout(() => {
          checkPublicBoardAuth();
        }, 50);
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