
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
  const [isBusinessPage, setIsBusinessPage] = useState<boolean | null>(null);
  
  // IMPROVED: Enhanced detection of business pages with multiple fallbacks
  const detectBusinessPage = (path: string): boolean => {
    // First - directly check the URL path (most reliable)
    if (path.startsWith('/business') || path.includes('/business/')) {
      console.log("[RouteGuard] Business page detected via path:", path);
      return true;
    }
    
    // Second - check window URL (catches redirects)
    if (window.location.href.includes('/business')) {
      console.log("[RouteGuard] Business page detected via window.location:", window.location.href);
      return true;
    }
    
    // Third - check query parameters 
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('slug') || searchParams.has('business')) {
      console.log("[RouteGuard] Business page detected via query params");
      return true;
    }
    
    // Fourth - check global flag from route-detector.js
    if (window.__IS_BUSINESS_PAGE__ === true) {
      console.log("[RouteGuard] Business page detected via global flag");
      return true;
    }
    
    // Fifth - check session storage
    if (sessionStorage.getItem('onBusinessPage') === 'true') {
      console.log("[RouteGuard] Business page detected via sessionStorage");
      return true;
    }
    
    // Sixth - check local storage as last resort
    if (localStorage.getItem('isBusinessPage') === 'true') {
      console.log("[RouteGuard] Business page detected via localStorage");
      return true;
    }
    
    return false;
  };
  
  // IMPROVED: Helper function to centralize public path logic with explicit business page bypass
  const isPublicPath = (path: string): boolean => {
    // Business pages are ALWAYS public - check this FIRST with the enhanced detector
    if (detectBusinessPage(path)) {
      setIsBusinessPage(true);
      return true;
    }
    
    // List of all paths that don't require authentication
    const publicPaths = ['/', '/login', '/signup', '/legal', '/contact', '/forgot-password', '/reset-password'];
    
    // Check if the path is in the public paths list
    return publicPaths.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'));
  };

  // Run business page detection IMMEDIATELY on component mount
  // This must happen before any other effects
  useEffect(() => {
    const currentPath = location.pathname;
    const isBusiness = detectBusinessPage(currentPath);
    
    if (isBusiness) {
      console.log("[RouteGuard] Setting business page flags on initial load");
      sessionStorage.setItem('onBusinessPage', 'true');
      localStorage.setItem('isBusinessPage', 'true');
      document.cookie = "isBusinessPage=true; path=/";
      setIsBusinessPage(true);
      
      // Set authorized immediately for business pages
      setIsAuthorized(true);
      setIsInitializing(false);
    } else {
      // Reset flags if not a business page
      setIsBusinessPage(false);
      sessionStorage.removeItem('onBusinessPage');
      localStorage.removeItem('isBusinessPage');
    }
  }, []);

  // Check if user is authorized to access the current route
  // This effect runs AFTER the business page detection effect
  useEffect(() => {
    // Skip entirely if we've already determined this is a business page
    if (isBusinessPage === true) {
      console.log("[RouteGuard] Business page already authorized, skipping auth checks");
      return;
    }
    
    const currentPath = location.pathname;
    const isPublic = isPublicPath(currentPath);
    
    console.log("[RouteGuard] Checking authorization for path:", currentPath, 
      "isPublic:", isPublic, 
      "User:", user ? "Authenticated" : "Unauthenticated",
      "isBusinessPage:", isBusinessPage);

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
  }, [user, loading, location, navigate, isBusinessPage]);

  // Special case for business pages - set flag and bypass checks
  // This is a SEPARATE effect specifically for handling route changes
  useEffect(() => {
    const handleRouteChange = () => {
      const isBusiness = detectBusinessPage(location.pathname);
      
      if (isBusiness) {
        console.log("[RouteGuard] Business page detected on route change");
        sessionStorage.setItem('onBusinessPage', 'true');
        localStorage.setItem('isBusinessPage', 'true');
        setIsBusinessPage(true);
        setIsAuthorized(true);
        setIsInitializing(false);
      } else if (isBusinessPage) {
        // Only clear flags if we're navigating away from a business page
        console.log("[RouteGuard] Leaving business page");
        sessionStorage.removeItem('onBusinessPage');
        localStorage.removeItem('isBusinessPage');
        setIsBusinessPage(false);
      }
    };
    
    handleRouteChange();
    
    return () => {
      // This cleanup only removes flags if we're not on a business page anymore
      if (!detectBusinessPage(location.pathname)) {
        sessionStorage.removeItem('onBusinessPage');
      }
    };
  }, [location.pathname]);

  // Final escape hatch - if we detect we're on a business page but authorization
  // hasn't been granted, force it
  useEffect(() => {
    if (detectBusinessPage(location.pathname) && !isAuthorized && !isInitializing) {
      console.log("[RouteGuard] Emergency business page authorization");
      setIsAuthorized(true);
    }
  }, [location.pathname, isAuthorized, isInitializing]);

  // Show loading indicator during initialization
  if (isInitializing && !isBusinessPage) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If authorized or on business page, render children
  return (isAuthorized || isBusinessPage) ? <>{children}</> : null;
};
