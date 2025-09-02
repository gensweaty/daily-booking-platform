/**
 * Gets the effective email for public board communications
 * This utility centralizes the logic for determining the correct email
 * to use when communicating on public boards
 */
export const getEffectivePublicEmail = (pathname: string, userEmail?: string): string | null => {
  // Extract slug from pathname for localStorage access
  const slug = pathname.split('/').pop();
  if (!slug) return userEmail || null;
  
  // Get stored access data
  let publicAccess = {};
  try {
    const stored = localStorage.getItem(`public-board-access-${slug}`);
    publicAccess = JSON.parse(stored || '{}') || {};
  } catch {
    publicAccess = {};
  }
  
  // Priority: user email > external_user_email > stored email
  const effectiveEmail = userEmail 
    || (publicAccess as any)?.external_user_email 
    || (publicAccess as any)?.email;
    
  return effectiveEmail || null;
};