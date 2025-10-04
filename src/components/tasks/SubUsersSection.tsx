import { useState, useEffect } from "react";
import { Users, Trash2, Clock, Mail, User, Settings, Calendar, BarChart3, UserCog } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserWithPermissions } from "@/hooks/useSubUserPermissions";

interface SubUser extends UserWithPermissions {}

interface SubUsersSectionProps {
  boardOwnerId?: string;
}

export const SubUsersSection = ({ boardOwnerId }: SubUsersSectionProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedSubUser, setSelectedSubUser] = useState<SubUser | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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
        .order('last_login_at', { ascending: false });

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
      const target = subUsers.find(u => u.id === subUserId);

      const { error } = await supabase
        .from('sub_users')
        .delete()
        .eq('id', subUserId)
        .eq('board_owner_id', boardOwnerId);

      if (error) throw error;

      // Also revoke any existing public access tokens for this sub user across this owner's boards
      if (target && boardOwnerId) {
        const { data: boards } = await supabase
          .from('public_boards')
          .select('id')
          .eq('user_id', boardOwnerId);
        const boardIds = (boards || []).map((b: any) => b.id);
        if (boardIds.length > 0) {
          await supabase
            .from('public_board_access')
            .delete()
            .in('board_id', boardIds)
            .ilike('external_user_email', (target.email || '').trim().toLowerCase());
        }
      }

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

  const handlePermissionUpdate = async (subUserId: string, permission: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('sub_users')
        .update({ [permission]: value })
        .eq('id', subUserId);

      if (error) throw error;

      // Update local state
      setSubUsers(prev => prev.map(user => 
        user.id === subUserId 
          ? { ...user, [permission]: value }
          : user
      ));

      toast({
        title: "Permission Updated",
        description: `${permission.replace('_', ' ')} permission ${value ? 'granted' : 'revoked'} successfully`,
      });
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: t("common.error"),
        description: "Failed to update permission",
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
                        
                        {/* Permission indicators */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {subUser.calendar_permission && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs">
                              <Calendar className="h-3 w-3" />
                              Calendar
                            </div>
                          )}
                          {subUser.crm_permission && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-full text-xs">
                              <UserCog className="h-3 w-3" />
                              CRM
                            </div>
                          )}
                          {subUser.statistics_permission && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 rounded-full text-xs">
                              <BarChart3 className="h-3 w-3" />
                              Statistics
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedUser(expandedUser === subUser.id ? null : subUser.id)}
                          className="hover:bg-muted"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSubUser(subUser);
                            setConfirmOpen(true);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Expandable permissions section */}
                    <AnimatePresence>
                      {expandedUser === subUser.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-4 pt-4 border-t border-border space-y-3"
                        >
                          <div className="text-sm font-medium text-foreground mb-2">Page Permissions:</div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              <span className="text-sm">Calendar Access</span>
                            </div>
                            <Switch
                              checked={subUser.calendar_permission}
                              onCheckedChange={(checked) => 
                                handlePermissionUpdate(subUser.id, 'calendar_permission', checked)
                              }
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserCog className="h-4 w-4 text-green-600" />
                              <span className="text-sm">CRM Access</span>
                            </div>
                            <Switch
                              checked={subUser.crm_permission}
                              onCheckedChange={(checked) => 
                                handlePermissionUpdate(subUser.id, 'crm_permission', checked)
                              }
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-purple-600" />
                              <span className="text-sm">Statistics Access</span>
                            </div>
                            <Switch
                              checked={subUser.statistics_permission}
                              onCheckedChange={(checked) => 
                                handlePermissionUpdate(subUser.id, 'statistics_permission', checked)
                              }
                            />
                          </div>
                          
                          <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                            <strong>Note:</strong> Task board access is automatically granted to all sub-users. Business page access is admin-only.
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("publicBoard.deleteSubUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("publicBoard.deleteSubUserConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedSubUser) {
                  handleDeleteSubUser(selectedSubUser.id);
                }
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};