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
  
  // Show (AI) for both admin and sub-user AI creations
  return isAI ? `${name} (AI)` : name;
}
