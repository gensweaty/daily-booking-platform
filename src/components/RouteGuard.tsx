
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoaderCircle } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
}

export const RouteGuard = ({ children }: RouteGuardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Helper function to centralize public path logic
  const isPublicPath = (path: string): boolean => {
    // List of all paths that don't require authentication
    const publicPaths = ['/', '/login', '/signup', '/legal', '/contact', '/forgot-password', '/reset-password'];
    
    // Business pages are always public
    if (path.startsWith('/business') || path.includes('/business/')) {
      console.log("[RouteGuard] Business page detected, skipping auth check:", path);
      return true;
    }
    
    // Check if URL parameters indicate this is a business page
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('slug') || searchParams.has('business')) {
      console.log("[RouteGuard] Business page parameters detected, skipping auth check");
      return true;
    }
    
    // Check the session flag as a final backup
    if (sessionStorage.getItem('onBusinessPage') === 'true') {
      console.log("[RouteGuard] Business page flag detected in sessionStorage, skipping auth check");
      return true;
    }
    
    // Check if the path is in the public paths list
    return publicPaths.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'));
  };

  // Check if user is authorized to access the current route
  useEffect(() => {
    const currentPath = location.pathname;
    const isPublic = isPublicPath(currentPath);
    
    console.log("[RouteGuard] Path:", currentPath, "isPublic:", isPublic, "User:", user ? "Authenticated" : "Unauthenticated");

    if (!loading) {
      // For public routes, always allow access
      if (isPublic) {
        console.log("[RouteGuard] Public path, allowing access");
        setIsAuthorized(true);
      } 
      // For protected routes, require authentication
      else if (user) {
        console.log("[RouteGuard] Protected path with authenticated user, allowing access");
        setIsAuthorized(true);
      } 
      // Redirect to login if trying to access protected route without authentication
      else {
        console.log("[RouteGuard] Protected path without authentication, redirecting to login");
        navigate('/login', { replace: true, state: { from: location } });
        setIsAuthorized(false);
      }
      
      setIsInitializing(false);
    }
  }, [user, loading, location, navigate]);

  // Special case for business pages - set flag and bypass checks
  useEffect(() => {
    if (location.pathname.includes('/business')) {
      console.log("[RouteGuard] Business page detected, setting flag");
      sessionStorage.setItem('onBusinessPage', 'true');
      setIsAuthorized(true);
      setIsInitializing(false);
    }
    
    return () => {
      if (!location.pathname.includes('/business')) {
        sessionStorage.removeItem('onBusinessPage');
      }
    };
  }, [location.pathname]);

  // Show loading indicator during initialization
  if (isInitializing || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If authorized, render children
  return isAuthorized ? <>{children}</> : null;
};
