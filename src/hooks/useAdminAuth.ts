
import { useState, useEffect } from 'react';

interface AdminSession {
  isAuthenticated: boolean;
  username: string;
  loginTime: number;
}

interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockoutUntil?: number;
}

const ADMIN_CREDENTIALS = {
  username: 'Anania39',
  password: 'Legioner95-'
};

const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 3;

export const useAdminAuth = () => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = () => {
    try {
      const storedSession = localStorage.getItem('admin_session');
      if (storedSession) {
        const parsed: AdminSession = JSON.parse(storedSession);
        
        // Check if session is still valid
        if (Date.now() - parsed.loginTime < SESSION_DURATION) {
          setSession(parsed);
        } else {
          localStorage.removeItem('admin_session');
        }
      }
    } catch (error) {
      console.error('Error checking admin session:', error);
      localStorage.removeItem('admin_session');
    }
    setIsLoading(false);
  };

  const getLoginAttempts = (): LoginAttempt => {
    try {
      const stored = localStorage.getItem('admin_login_attempts');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error reading login attempts:', error);
    }
    return { count: 0, lastAttempt: 0 };
  };

  const setLoginAttempts = (attempts: LoginAttempt) => {
    localStorage.setItem('admin_login_attempts', JSON.stringify(attempts));
  };

  const isLockedOut = (): boolean => {
    const attempts = getLoginAttempts();
    if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
      return true;
    }
    return false;
  };

  const login = (username: string, password: string): { success: boolean; error?: string } => {
    if (isLockedOut()) {
      const attempts = getLoginAttempts();
      const remainingTime = Math.ceil((attempts.lockoutUntil! - Date.now()) / (60 * 1000));
      return {
        success: false,
        error: `Too many failed attempts. Try again in ${remainingTime} minutes.`
      };
    }

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      const newSession: AdminSession = {
        isAuthenticated: true,
        username,
        loginTime: Date.now()
      };
      
      setSession(newSession);
      localStorage.setItem('admin_session', JSON.stringify(newSession));
      
      // Reset login attempts on successful login
      localStorage.removeItem('admin_login_attempts');
      
      return { success: true };
    } else {
      // Record failed attempt
      const attempts = getLoginAttempts();
      const newAttempts: LoginAttempt = {
        count: attempts.count + 1,
        lastAttempt: Date.now()
      };

      if (newAttempts.count >= MAX_ATTEMPTS) {
        newAttempts.lockoutUntil = Date.now() + LOCKOUT_DURATION;
      }

      setLoginAttempts(newAttempts);

      return {
        success: false,
        error: `Invalid credentials. ${MAX_ATTEMPTS - newAttempts.count} attempts remaining.`
      };
    }
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem('admin_session');
  };

  return {
    session,
    isLoading,
    login,
    logout,
    isLockedOut: isLockedOut()
  };
};
