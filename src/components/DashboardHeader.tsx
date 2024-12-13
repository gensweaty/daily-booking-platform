import { Button } from "@/components/ui/button";
import { LogOut, User, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

interface DashboardHeaderProps {
  username: string;
}

interface UserProfile {
  role: string | null;
  registered_by: string | null;
}

export const DashboardHeader = ({ username }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (user) {
        try {
          // First get the user's profile
          const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role, registered_by')
            .eq('id', user.id)
            .single();

          if (profileError) throw profileError;

          if (userProfile) {
            setUserRole(userProfile.role);

            // If user was registered by someone, fetch admin's username
            if (userProfile.registered_by) {
              const { data: adminProfile, error: adminError } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', userProfile.registered_by)
                .single();

              if (adminError) throw adminError;
              
              if (adminProfile) {
                setAdminName(adminProfile.username);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          toast({
            title: "Error",
            description: "Failed to load user profile",
            variant: "destructive",
          });
        }
      }
    };

    fetchUserDetails();
  }, [user, toast]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: window.location.origin + '/reset-password',
      });

      if (error) throw error;

      toast({
        title: "Password Reset Email Sent",
        description: "Please check your email for the password reset link.",
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Error",
        description: "Failed to send password reset email. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-2">Welcome to Taskify Minder Note</h1>
          <p className="text-foreground">
            {username ? `Hello ${username}!` : 'Welcome!'} Complete Agile productivity - tasks notes calendar all in one
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                className="text-foreground"
              >
                <User className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>User Profile</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Username</p>
                  <p className="text-sm text-muted-foreground">{username}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Role</p>
                  <p className="text-sm text-muted-foreground">{userRole}</p>
                </div>
                {userRole === 'user' && adminName && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Admin</p>
                    <p className="text-sm text-muted-foreground">{adminName}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Package</p>
                  <p className="text-sm text-muted-foreground">Free Plan</p>
                </div>
                {(userRole === 'admin' || userRole === 'super_admin') && (
                  <div className="pt-4">
                    <Button 
                      variant="outline" 
                      className="w-full flex items-center gap-2"
                      onClick={() => navigate('/users')}
                    >
                      <Users className="w-4 h-4" />
                      Your Users
                    </Button>
                  </div>
                )}
                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleChangePassword}
                  >
                    Change Password
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <ThemeToggle />
          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};