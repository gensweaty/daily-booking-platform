
import React, { useState, useEffect } from 'react';
import { Bell, User, LogOut, Settings, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageText } from '@/components/shared/LanguageText';
import { GeorgianAuthText } from '@/components/shared/GeorgianAuthText';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { AvatarUpload } from '@/components/profile/AvatarUpload';

interface Subscription {
  id: string;
  plan_type: string;
  status: string;
  current_period_end: string | null;
  trial_end_date: string | null;
}

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
}

export const DashboardHeader = () => {
  const { user, signOut } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [showProfile, setShowProfile] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const isGeorgian = language === 'ka';

  const fetchSubscriptionData = async (showToast = false) => {
    if (!user || isLoading) return;
    
    setIsLoading(true);
    try {
      // Fetch subscription
      const { data: subscriptionData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        if (showToast) {
          toast({
            title: t('profile.failedRefreshSubscription'),
            variant: 'destructive',
          });
        }
        return;
      }

      setSubscription(subscriptionData);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setProfile(profileData);
      }

      if (showToast && subscriptionData) {
        toast({
          title: t('profile.statusRefreshed'),
          description: t('profile.syncComplete'),
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (showToast) {
        toast({
          title: t('profile.syncError'),
          description: t('profile.pleaseTryAgain'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscriptionData();
    }
  }, [user]);

  useEffect(() => {
    const updateTimeLeft = () => {
      if (!subscription) {
        setTimeLeft('');
        return;
      }

      const now = new Date();
      let targetDate: Date | null = null;

      if (subscription.status === 'trial' && subscription.trial_end_date) {
        targetDate = new Date(subscription.trial_end_date);
      } else if (subscription.status === 'active' && subscription.current_period_end) {
        targetDate = new Date(subscription.current_period_end);
      }

      if (!targetDate || targetDate <= now) {
        setTimeLeft('');
        return;
      }

      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        setTimeLeft(`${diffDays} ${diffDays === 1 ? 'day' : 'days'}`);
      } else {
        setTimeLeft('');
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000);

    return () => clearInterval(interval);
  }, [subscription]);

  const handleSync = async () => {
    setIsSyncing(true);
    await fetchSubscriptionData(true);
    setIsSyncing(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      toast({
        title: t('profile.signOutError'),
        description: t('profile.pleaseTryAgain'),
        variant: 'destructive',
      });
    }
  };

  const handleAvatarUpdate = (url: string) => {
    if (profile) {
      setProfile({ ...profile, avatar_url: url });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'trial': return 'secondary';
      case 'expired': return 'destructive';
      default: return 'outline';
    }
  };

  const getDisplayStatus = (status: string) => {
    if (isGeorgian) {
      switch (status) {
        case 'active': return <GeorgianAuthText>აქტიური</GeorgianAuthText>;
        case 'trial': return <GeorgianAuthText>საცდელი</GeorgianAuthText>;
        case 'expired': return <GeorgianAuthText>ვადაგასული</GeorgianAuthText>;
        default: return status;
      }
    }
    return t(`profile.${status}`);
  };

  const getUserInitials = () => {
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {isGeorgian ? (
                  <GeorgianAuthText>{t('dashboard.welcome')}</GeorgianAuthText>
                ) : (
                  <LanguageText>{t('dashboard.welcome')}</LanguageText>
                )}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={profile?.avatar_url} 
                        alt={profile?.username || user?.email || 'User'} 
                      />
                      <AvatarFallback className="text-xs">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuItem onClick={() => setShowProfile(true)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>
                      {isGeorgian ? (
                        <GeorgianAuthText>{t('profile.title')}</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t('profile.title')}</LanguageText>
                      )}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>
                      {isGeorgian ? (
                        <GeorgianAuthText>{t('dashboard.more')}</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t('dashboard.more')}</LanguageText>
                      )}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>
                      {isGeorgian ? (
                        <GeorgianAuthText>{t('dashboard.signOut')}</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t('dashboard.signOut')}</LanguageText>
                      )}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {isGeorgian ? (
                <GeorgianAuthText>{t('profile.userProfile')}</GeorgianAuthText>
              ) : (
                <LanguageText>{t('profile.userProfile')}</LanguageText>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4">
              <AvatarUpload 
                avatarUrl={profile?.avatar_url} 
                onAvatarUpdate={handleAvatarUpdate}
              />
            </div>

            {/* User Info */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {isGeorgian ? (
                    <GeorgianAuthText>{t('profile.emailAddress')}</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t('profile.emailAddress')}</LanguageText>
                  )}
                </label>
                <p className="text-sm text-gray-900 mt-1">{user?.email}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {isGeorgian ? (
                    <GeorgianAuthText>{t('profile.username')}</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t('profile.username')}</LanguageText>
                  )}
                </label>
                <p className="text-sm text-gray-900 mt-1">{profile?.username || 'Not set'}</p>
              </div>

              {/* Subscription Info */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    {isGeorgian ? (
                      <GeorgianAuthText>{t('profile.subscriptionStatus')}</GeorgianAuthText>
                    ) : (
                      <LanguageText>{t('profile.subscriptionStatus')}</LanguageText>
                    )}
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? (
                      isGeorgian ? (
                        <GeorgianAuthText>{t('profile.syncing')}</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t('profile.syncing')}</LanguageText>
                      )
                    ) : (
                      isGeorgian ? (
                        <GeorgianAuthText>{t('profile.sync')}</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t('profile.sync')}</LanguageText>
                      )
                    )}
                  </Button>
                </div>

                {subscription ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(subscription.status)}>
                        {getDisplayStatus(subscription.status)}
                      </Badge>
                      <span className="text-sm text-gray-600 capitalize">
                        {subscription.plan_type} plan
                      </span>
                    </div>
                    
                    {timeLeft && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">
                          {isGeorgian ? (
                            <GeorgianAuthText>{t('profile.timeLeft')}</GeorgianAuthText>
                          ) : (
                            <LanguageText>{t('profile.timeLeft')}</LanguageText>
                          )}
                        </span>
                        : {timeLeft}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {isGeorgian ? (
                      <GeorgianAuthText>{t('profile.noSubscriptionInfo')}</GeorgianAuthText>
                    ) : (
                      <LanguageText>{t('profile.noSubscriptionInfo')}</LanguageText>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
