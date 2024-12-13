import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Trash2, Edit } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AddUserForm } from "@/components/users/AddUserForm";
import { EditUserForm } from "@/components/users/EditUserForm";
import { format } from "date-fns";
import { DashboardHeader } from "@/components/DashboardHeader";

export const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (data) {
          setUserRole(data.role);
        }
      }
    };

    fetchUserRole();
  }, [user]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user || !userRole) return;

      let query = supabase
        .from('profiles')
        .select(`
          id,
          username,
          email:auth.users!id(email),
          role,
          created_at,
          last_active,
          registered_by,
          admin:profiles!registered_by(username)
        `)
        .order('created_at', { ascending: false });

      if (userRole === 'admin') {
        query = query.eq('registered_by', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching users:', error);
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        });
        return;
      }

      setUsers(data || []);
    };

    fetchUsers();
  }, [user, userRole]);

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) throw error;
      
      setUsers(users.filter(u => u.id !== userId));
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!userRole || (userRole !== 'super_admin' && userRole !== 'admin')) {
    return <div>Access denied</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <DashboardHeader username="" />
      
      <Card className="max-w-[90%] xl:max-w-[85%] 2xl:max-w-[80%] mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>User Management</CardTitle>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <AddUserForm onSuccess={() => {
                setIsAddUserOpen(false);
                // Refresh users list
                window.location.reload();
              }} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Username</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Role</th>
                  {userRole === 'super_admin' && (
                    <th className="text-left p-2">Registered By</th>
                  )}
                  <th className="text-left p-2">Registration Date</th>
                  <th className="text-left p-2">Last Active</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-2">{user.username}</td>
                    <td className="p-2">{user.email?.email}</td>
                    <td className="p-2">{user.role}</td>
                    {userRole === 'super_admin' && (
                      <td className="p-2">{user.admin?.username || '-'}</td>
                    )}
                    <td className="p-2">{format(new Date(user.created_at), 'PP')}</td>
                    <td className="p-2">{user.last_active ? format(new Date(user.last_active), 'PP') : '-'}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setEditingUser(user)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit User</DialogTitle>
                            </DialogHeader>
                            <EditUserForm
                              user={editingUser}
                              onSuccess={() => {
                                setEditingUser(null);
                                window.location.reload();
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};