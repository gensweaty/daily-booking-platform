
// This script runs before React to detect business pages early
(function() {
  try {
    // Check if the URL contains '/business' path
    if (window.location.href.includes('/business')) {
      // Set a flag in sessionStorage
      sessionStorage.setItem('onBusinessPage', 'true');
      
      // Add a class to the document for CSS usage
      document.documentElement.classList.add('is-business-page');
      
      // Set cookies for server-side detection
      document.cookie = "isBusinessPage=true; path=/";
      
      // Use localStorage as another backup
      localStorage.setItem('isBusinessPage', 'true');
      
      // Store the page URL for potential recovery
      localStorage.setItem('lastBusinessPageUrl', window.location.href);
      
      console.log("[PreReact] Business page detected, flags set");
    }
    
    // Add a global error handler that checks if the redirect is happening
    var redirectCount = parseInt(sessionStorage.getItem('redirectCount') || '0');
    if (redirectCount > 5 && window.location.href.includes('/business')) {
      console.error("[PreReact] Too many redirects detected, restoring business page flag");
      sessionStorage.setItem('onBusinessPage', 'true');
      document.documentElement.classList.add('is-business-page');
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
