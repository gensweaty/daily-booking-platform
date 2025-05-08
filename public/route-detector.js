
// This script runs before React to detect business pages early
(function() {
  try {
    // Check if the URL contains '/business' path
    if (window.location.href.includes('/business')) {
      console.log("[PreReact] Business page detected, setting flags");
      
      // Set a flag in sessionStorage
      sessionStorage.setItem('onBusinessPage', 'true');
      
      // Add a class to the document for CSS usage
      document.documentElement.classList.add('is-business-page');
      
      // Set cookies for server-side detection
      document.cookie = "isBusinessPage=true; path=/; max-age=3600";
      
      // Use localStorage as another backup
      localStorage.setItem('isBusinessPage', 'true');
      localStorage.setItem('lastBusinessPageUrl', window.location.href);
      
      // Create a global variable that React can check very early
      window.__IS_BUSINESS_PAGE__ = true;
      
      // Create a meta tag for server rendering
      var meta = document.createElement('meta');
      meta.name = 'x-is-business-page';
      meta.content = 'true';
      document.head.appendChild(meta);
    }
    
    // Add a global error handler that checks if the redirect is happening
    var redirectCount = parseInt(sessionStorage.getItem('redirectCount') || '0');
    if (redirectCount > 3 && window.location.href.includes('/business')) {
      console.error("[PreReact] Too many redirects detected, attempting recovery");
      sessionStorage.setItem('onBusinessPage', 'true');
      document.documentElement.classList.add('is-business-page');
      localStorage.setItem('isBusinessPage', 'true');
      
      // Force lock the route
      window.__ROUTE_LOCKED__ = true;
      redirectCount = 0;
    } 
    sessionStorage.setItem('redirectCount', (redirectCount + 1).toString());
    
    // Reset counter after 5 seconds
    setTimeout(function() {
      sessionStorage.removeItem('redirectCount');
    }, 5000);
  } catch (e) {
    console.error("[PreReact] Error in route detector:", e);
  }
})();
