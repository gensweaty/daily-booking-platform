import { ReactNode } from 'react';
import { useSubUserPermissions } from '@/hooks/useSubUserPermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, ShieldX } from 'lucide-react';

interface PermissionGateProps {
  requiredPermission: 'calendar' | 'crm' | 'statistics';
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGate = ({ requiredPermission, children, fallback }: PermissionGateProps) => {
  const { hasPermission, loading, isSubUser } = useSubUserPermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission(requiredPermission)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] p-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Access Denied</h3>
              <p className="text-sm text-muted-foreground">
                You don't have permission to access the {requiredPermission} page.
                {isSubUser && " Please contact your administrator to request access."}
              </p>
            </div>
            {isSubUser && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sub-user account</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};