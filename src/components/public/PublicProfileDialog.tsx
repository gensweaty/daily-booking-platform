import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { SubUserAvatarUpload } from "./SubUserAvatarUpload";
import { PublicProfileButton } from "./PublicProfileButton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LanguageText } from "@/components/shared/LanguageText";
import { supabase } from "@/lib/supabase";

// Password hashing utilities (same as in PublicBoard.tsx)
const bufToBase64 = (buffer: ArrayBuffer) => {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(binary);
};

const base64ToBuf = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const deriveBits = async (password: string, salt: Uint8Array) => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
};

const createPasswordHash = async (password: string) => {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const bits = await deriveBits(password, salt);
  return { hash: bufToBase64(bits), salt: bufToBase64(salt.buffer) };
};

interface PublicProfileDialogProps {
  boardUserId: string;
  userEmail: string;
  userName: string;
  className?: string;
}

export const PublicProfileDialog = ({
  boardUserId,
  userEmail,
  userName,
  className
}: PublicProfileDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayUserName, setDisplayUserName] = useState(userName);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const fetchSubUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_users')
        .select('fullname, avatar_url')
        .eq('board_owner_id', boardUserId)
        .ilike('email', userEmail.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('Error fetching sub user profile:', error);
        return;
      }

      if (data?.fullname) {
        setDisplayUserName(data.fullname);
      }
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Error fetching sub user profile:', error);
    }
  };

  // Load profile data on component mount
  useEffect(() => {
    fetchSubUserProfile();
  }, [boardUserId, userEmail]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      fetchSubUserProfile(); // Refresh data when dialog opens
    }
  };

  // Sub-user avatar upload handler - saves to database
  const handleSubUserAvatarUpload = async (file: File) => {
    try {
      // Convert file to base64 data URL
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        
        // Save avatar URL to database
        const { error } = await supabase
          .from('sub_users')
          .update({ 
            avatar_url: result,
            updated_at: new Date().toISOString()
          })
          .eq('board_owner_id', boardUserId)
          .ilike('email', userEmail.trim().toLowerCase());

        if (error) {
          throw error;
        }

        setAvatarUrl(result);
        
        toast({
          title: t('common.success'),
          description: "Avatar updated successfully",
        });
      };
      reader.onerror = () => {
        throw new Error('Failed to read file');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading sub-user avatar:', error);
      toast({
        title: t('common.error'),
        description: "Failed to update avatar",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast({
        title: t('common.error'),
        description: "Please enter both password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { hash, salt } = await createPasswordHash(newPassword);

      const { error } = await supabase
        .from('sub_users')
        .update({ 
          password_hash: hash,
          password_salt: salt,
          updated_at: new Date().toISOString()
        })
        .eq('board_owner_id', boardUserId)
        .ilike('email', userEmail.trim().toLowerCase());

      if (error) {
        throw error;
      }

      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: t('common.success'),
        description: "Password updated successfully",
      });
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: t('common.error'),
        description: "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <div>
          <PublicProfileButton 
            onClick={() => {}} 
            mobileVersion={isMobile}
            avatarUrl={avatarUrl}
            userName={displayUserName}
            userEmail={userEmail}
            className="md:flex hidden"
          />
          <PublicProfileButton 
            onClick={() => {}} 
            mobileVersion={true}
            avatarUrl={avatarUrl}
            userName={displayUserName}
            userEmail={userEmail}
            className="md:hidden flex"
          />
        </div>
      </DialogTrigger>
      <DialogContent 
        className={
          isMobile 
            ? 'mobile-dialog w-screen h-screen max-w-none max-h-none p-0 border-0 rounded-none' 
            : 'sm:max-w-[600px] max-h-[90vh] p-0'
        }
        style={isMobile ? {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          transform: 'none',
          margin: '0',
          borderRadius: '0'
        } : {}}
      >
        <style>{`
          .mobile-dialog[data-state="open"] {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            max-height: none !important;
            transform: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
            border: none !important;
          }
        `}</style>
        
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold mb-2 text-center`}>
                <LanguageText>{t('profile.userProfile')}</LanguageText>
              </DialogTitle>
            </DialogHeader>
            <div className="text-center">
              <div className="mx-auto mb-4">
                <SubUserAvatarUpload 
                  avatarUrl={avatarUrl}
                  onAvatarUpload={handleSubUserAvatarUpload}
                  size={isMobile ? "md" : "lg"}
                />
              </div>
              <p className={`text-white/90 ${isMobile ? 'text-base' : 'text-lg'}`}>
                <LanguageText>{t('profile.welcomeBack')}</LanguageText>
              </p>
            </div>
          </div>
        </div>

        <div className={`${isMobile ? 'p-4 space-y-6 overflow-y-auto flex-1' : 'p-8 space-y-8'}`}>
          {/* Account Information */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 md:p-6 border border-blue-200/50 dark:border-blue-800/50">
            <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2`}>
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <LanguageText>{t('profile.accountInformation')}</LanguageText>
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 md:p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-300`}>
                    <LanguageText>{t('profile.emailAddress')}</LanguageText>
                  </p>
                </div>
                <p className={`${isMobile ? 'text-sm pl-9' : 'text-lg font-semibold pl-11'} text-gray-800 dark:text-gray-200 break-all`}>{userEmail}</p>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-3 md:p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-600 dark:text-gray-300`}>
                    <LanguageText>{t('profile.username')}</LanguageText>
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border">
                  <p className={`${isMobile ? 'text-sm pl-9' : 'text-lg font-semibold pl-11'} text-gray-800 dark:text-gray-200`}>
                    {displayUserName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Section */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4 md:p-6 border border-orange-200/50 dark:border-orange-800/50">
            <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2`}>
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <LanguageText>Change Password</LanguageText>
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full"
                />
              </div>
              
              <Button
                onClick={handleChangePassword}
                disabled={isUpdatingPassword}
                className="w-full"
              >
                {isUpdatingPassword ? "Updating Password..." : "Update Password"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};