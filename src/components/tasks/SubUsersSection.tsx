import { useState, useEffect } from "react";
import { Users, Trash2, Clock, Mail, User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface SubUser {
  id: string;
  fullname: string;
  email: string;
  last_login_at: string;
  created_at: string;
}

interface SubUsersSectionProps {
  boardOwnerId?: string;
}

export const SubUsersSection = ({ boardOwnerId }: SubUsersSectionProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (boardOwnerId) {
      fetchSubUsers();
      
      // Set up real-time updates for sub_users table
      const channel = supabase
        .channel('sub-users-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sub_users',
            filter: `board_owner_id=eq.${boardOwnerId}`
          },
          (payload) => {
            console.log('Sub user change:', payload);
            // Delay refresh to ensure data is committed
            setTimeout(() => {
              fetchSubUsers();
            }, 300);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [boardOwnerId]);

  const fetchSubUsers = async () => {
    if (!boardOwnerId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sub_users')
        .select('*')
        .eq('board_owner_id', boardOwnerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubUsers(data || []);
    } catch (error) {
      console.error('Error fetching sub users:', error);
      toast({
        title: t("common.error"),
        description: "Failed to load sub users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubUser = async (subUserId: string) => {
    try {
      const { error } = await supabase
        .from('sub_users')
        .delete()
        .eq('id', subUserId)
        .eq('board_owner_id', boardOwnerId);

      if (error) throw error;

      setSubUsers(prev => prev.filter(user => user.id !== subUserId));
      toast({
        title: t("common.success"),
        description: "Sub user deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting sub user:', error);
      toast({
        title: t("common.error"),
        description: "Failed to delete sub user",
        variant: "destructive",
      });
    }
  };

  const formatLastLogin = (lastLoginAt: string) => {
    const date = new Date(lastLoginAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("publicBoard.subUsers")} ({subUsers.length}/10)
        </Label>
        {subUsers.length >= 10 && (
          <span className="text-xs text-amber-600 font-medium">
            Maximum limit reached
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          <AnimatePresence>
            {subUsers.map((subUser) => (
              <motion.div
                key={subUser.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border border-border/50 hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{subUser.fullname}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{subUser.email}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                           <span className="text-xs text-muted-foreground">
                             {t("publicBoard.lastLogin")}: {formatLastLogin(subUser.last_login_at)}
                           </span>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteSubUser(subUser.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {subUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sub users registered yet</p>
              <p className="text-xs mt-1">Users will appear here after they register on your public board</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};