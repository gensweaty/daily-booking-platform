import React, { createContext, useContext } from "react";

interface MockAuthContextType {
  user: { id: string } | null;
  session: { user: { id: string } } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const MockAuthContext = createContext<MockAuthContextType>({
  user: null,
  session: null,
  loading: false,
  signOut: async () => {},
});

export const useMockAuth = () => useContext(MockAuthContext);

interface PublicAuthProviderProps {
  children: React.ReactNode;
  userId: string;
}

export const PublicAuthProvider = ({ children, userId }: PublicAuthProviderProps) => {
  const mockAuth: MockAuthContextType = {
    user: { id: userId },
    session: { user: { id: userId } },
    loading: false,
    signOut: async () => {},
  };

  return (
    <MockAuthContext.Provider value={mockAuth}>
      {children}
    </MockAuthContext.Provider>
  );
};

// This component will override the useAuth hook for its children
export const AuthOverrideProvider = ({ children, userId }: PublicAuthProviderProps) => {
  // Store the original useAuth hook
  const originalModule = require("@/contexts/AuthContext");
  const originalUseAuth = originalModule.useAuth;

  // Override the useAuth function
  React.useLayoutEffect(() => {
    originalModule.useAuth = () => ({
      user: { id: userId },
      session: { user: { id: userId } },
      loading: false,
      signOut: async () => {},
    });

    return () => {
      // Restore original on cleanup
      originalModule.useAuth = originalUseAuth;
    };
  }, [userId, originalUseAuth]);

  return <>{children}</>;
};