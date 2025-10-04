
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useUserLanguage = () => {
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Save user's language preference to database
  const saveLanguagePreference = async (lang: string) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // First, get the current profile to preserve existing username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: profile?.username || `user_${user.id.slice(0, 8)}`,
          language: lang,
        }, {
          onConflict: 'id'
        });
      
      if (error) {
        console.error('Error saving language preference:', error);
      } else {
        console.log('Language preference saved:', lang);
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load user's language preference from database
  const loadLanguagePreference = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error loading language preference:', error);
        return;
      }
      
      if (data?.language && data.language !== language) {
        setLanguage(data.language as 'en' | 'es' | 'ka');
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    }
  };

  // Update language and save preference
  const updateLanguage = async (newLanguage: 'en' | 'es' | 'ka') => {
    setLanguage(newLanguage);
    await saveLanguagePreference(newLanguage);
  };

  // Load language preference on user change
  useEffect(() => {
    if (user?.id) {
      loadLanguagePreference();
    }
  }, [user?.id]);

  // Save language preference when language changes
  useEffect(() => {
    if (user?.id && language) {
      saveLanguagePreference(language);
    }
  }, [language, user?.id]);

  return {
    language,
    updateLanguage,
    isLoading,
  };
};
