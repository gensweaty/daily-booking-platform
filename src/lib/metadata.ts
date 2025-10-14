/**
 * Shared utility for formatting attribution metadata
 * Shows "(AI)" suffix ONLY for sub-user AI creations
 */

export function formatAttribution(
  name?: string | null, 
  type?: string | null, 
  isAI?: boolean | null
): string {
  if (!name) return '';
  
  const isSub = type === 'sub_user';
  
  // Show (AI) only for sub-user AI creations
  return (isAI && isSub) ? `${name} (AI)` : name;
}
