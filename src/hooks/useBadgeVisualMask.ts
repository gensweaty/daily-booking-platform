import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pure visual badge masking system.
 * Instantly hides badges via DOM manipulation, no React state timing issues.
 */
export function useBadgeVisualMask(
  providerChannelUnreads: Record<string, number>,
  currentChannelId: string | null
) {
  // Simple Set of channelIds that should be visually hidden
  const [visuallyHidden, setVisuallyHidden] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Hide a badge immediately (both DOM and state)
  const hideBadgeNow = useCallback((channelId: string) => {
    // 1. Direct DOM manipulation for instant visual effect
    const badgeElement = document.querySelector(`[data-badge-id="${channelId}"]`) as HTMLElement;
    if (badgeElement) {
      badgeElement.style.display = 'none';
      badgeElement.style.opacity = '0';
    }

    // 2. Update visual mask for subsequent renders
    setVisuallyHidden(prev => {
      const next = new Set(prev);
      next.add(channelId);
      return next;
    });

    // 3. Set timeout to auto-unhide after 3 seconds (failsafe)
    const existingTimeout = timeoutsRef.current.get(channelId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      showBadgeNow(channelId);
    }, 3000);
    
    timeoutsRef.current.set(channelId, timeout);
  }, []);

  // Show a badge (remove from visual mask)
  const showBadgeNow = useCallback((channelId: string) => {
    // Clear any pending timeout
    const existingTimeout = timeoutsRef.current.get(channelId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutsRef.current.delete(channelId);
    }

    // Remove from visual mask
    setVisuallyHidden(prev => {
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });

    // Show DOM element
    const badgeElement = document.querySelector(`[data-badge-id="${channelId}"]`) as HTMLElement;
    if (badgeElement) {
      badgeElement.style.display = '';
      badgeElement.style.opacity = '';
    }
  }, []);

  // Auto-unhide badges when conditions are met
  useEffect(() => {
    if (visuallyHidden.size === 0) return;

    setVisuallyHidden(prev => {
      let changed = false;
      const next = new Set(prev);

      for (const channelId of prev) {
        const shouldUnhide = 
          // Provider count is now 0
          (providerChannelUnreads[channelId] ?? 0) === 0 ||
          // Channel became active
          currentChannelId === channelId;

        if (shouldUnhide) {
          next.delete(channelId);
          changed = true;
          
          // Clear timeout
          const timeout = timeoutsRef.current.get(channelId);
          if (timeout) {
            clearTimeout(timeout);
            timeoutsRef.current.delete(channelId);
          }
          
          // Show DOM element
          const badgeElement = document.querySelector(`[data-badge-id="${channelId}"]`) as HTMLElement;
          if (badgeElement) {
            badgeElement.style.display = '';
            badgeElement.style.opacity = '';
          }
        }
      }

      return changed ? next : prev;
    });
  }, [providerChannelUnreads, currentChannelId, visuallyHidden.size]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  // Check if a badge should be visually hidden
  const isBadgeHidden = useCallback((channelId: string) => {
    return visuallyHidden.has(channelId);
  }, [visuallyHidden]);

  return {
    hideBadgeNow,
    showBadgeNow,
    isBadgeHidden
  };
}