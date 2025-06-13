
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Download, ChevronLeft, ChevronRight, Users, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UserData {
  id: string;
  username: string;
  email: string;
  registeredOn: string;
  lastLogin: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  tasksCount: number;
  bookingsCount: number;
  customersCount: number;
  hasBusinessProfile: boolean;
}

export const CRMTable = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(20);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [searchTerm, users]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const { data: userData, error } = await supabase.functions.invoke('admin-panel-data', {
        body: { type: 'users' }
      });

      if (error) throw error;
      
      console.log('Fetched user data:', userData);
      setUsers(userData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Username',
      'Email',
      'Registered On',
      'Last Login',
      'Subscription Plan',
      'Status',
      'Tasks',
      'Bookings',
      'Customers',
      'Has Business Profile'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredUsers.map(user => [
        user.username,
        user.email,
        user.registeredOn,
        user.lastLogin,
        user.subscriptionPlan,
        user.subscriptionStatus,
        user.tasksCount,
        user.bookingsCount,
        user.customersCount,
        user.hasBusinessProfile ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string, plan: string) => {
    if (status === 'expired' || status === 'trial_expired') {
      return <Badge variant="destructive" className="font-medium">Expired</Badge>;
    }
    if (status === 'trial') {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 font-medium">Trial</Badge>;
    }
    if (plan === 'ultimate' && status === 'active') {
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 font-medium">Ultimate</Badge>;
    }
    if (plan === 'yearly' && status === 'active') {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-medium">Yearly</Badge>;
    }
    if (plan === 'monthly' && status === 'active') {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 font-medium">Monthly</Badge>;
    }
    return <Badge variant="secondary" className="font-medium">{status}</Badge>;
  };

  // Pagination
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  if (loading) {
    return (
      <Card className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded-lg"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl font-semibold text-foreground">
              User Management ({filteredUsers.length} users)
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={fetchUserData} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={exportToCSV} 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by username or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background border-border focus:border-primary transition-colors"
          />
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-foreground">Username</TableHead>
                <TableHead className="font-semibold text-foreground">Email</TableHead>
                <TableHead className="font-semibold text-foreground">Registered</TableHead>
                <TableHead className="font-semibold text-foreground">Last Login</TableHead>
                <TableHead className="font-semibold text-foreground">Plan</TableHead>
                <TableHead className="font-semibold text-foreground">Tasks</TableHead>
                <TableHead className="font-semibold text-foreground">Bookings</TableHead>
                <TableHead className="font-semibold text-foreground">Customers</TableHead>
                <TableHead className="font-semibold text-foreground">Business</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentUsers.length > 0 ? (
                currentUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">{user.username}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.registeredOn).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.subscriptionStatus, user.subscriptionPlan)}
                    </TableCell>
                    <TableCell className="text-center font-medium">{user.tasksCount}</TableCell>
                    <TableCell className="text-center font-medium">{user.bookingsCount}</TableCell>
                    <TableCell className="text-center font-medium">{user.customersCount}</TableCell>
                    <TableCell>
                      {user.hasBusinessProfile ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No users found matching your search criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <span className="text-sm font-medium px-3 py-1 bg-muted rounded-md">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
