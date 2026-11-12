import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminSession {
  isAuthenticated: boolean;
  username: string;
  loginTime: number;
  token: string;
  exp: number;
}

const KEY = 'admin_session';

export const getAdminToken = (): string | null => {
  try {
    const s: AdminSession = JSON.parse(localStorage.getItem(KEY) || 'null');
    return s?.token && s.exp > Date.now() ? s.token : null;
  } catch { return null; }
};

/** Invoke an admin edge function with the server-issued admin token. */
export const invokeAdmin = (fn: string, body: unknown) =>
  supabase.functions.invoke(fn, { body, headers: { 'x-admin-token': getAdminToken() || '' } });

export const useAdminAuth = () => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const s: AdminSession = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s?.token && s.exp > Date.now()) setSession(s);
      else localStorage.removeItem(KEY);
    } catch { localStorage.removeItem(KEY); }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { data, error } = await supabase.functions.invoke('admin-login', { body: { username, password } });
    if (error || !data?.token) {
      return { success: false, error: 'Invalid credentials or too many attempts.' };
    }
    const s: AdminSession = { isAuthenticated: true, username, loginTime: Date.now(), token: data.token, exp: data.exp };
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.removeItem('admin_login_attempts');
    setSession(s);
    return { success: true };
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(KEY);
  };

  return { session, isLoading, login, logout, isLockedOut: false };
};
