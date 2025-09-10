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
  const lastResetKeyRef = useRef<string>('');

  // Reset function to clear all accumulated state (mimics page refresh)
  const resetAllState = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    
    // Clear visual mask
    setVisuallyHidden(new Set());
    
    // Reset all DOM elements (remove any inline styles we added)
    document.querySelectorAll('[data-badge-id]').forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.display = '';
      htmlElement.style.opacity = '';
    });
  }, []);

  // Auto-reset when provider context changes significantly (like page refresh)
  useEffect(() => {
    const currentResetKey = `${Object.keys(providerChannelUnreads).length}-${currentChannelId}`;
    if (lastResetKeyRef.current && lastResetKeyRef.current !== currentResetKey) {
      // Context changed significantly, reset everything
      resetAllState();
    }
    lastResetKeyRef.current = currentResetKey;
  }, [providerChannelUnreads, currentChannelId, resetAllState]);

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

    // Show DOM element with requestAnimationFrame for timing
    requestAnimationFrame(() => {
      const badgeElement = document.querySelector(`[data-badge-id="${channelId}"]`) as HTMLElement;
      if (badgeElement) {
        badgeElement.style.display = '';
        badgeElement.style.opacity = '';
      }
    });
  }, []);

  // Hide a badge immediately (both DOM and state)
  const hideBadgeNow = useCallback((channelId: string) => {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const badgeElement = document.querySelector(`[data-badge-id="${channelId}"]`) as HTMLElement;
      if (badgeElement) {
        badgeElement.style.display = 'none';
        badgeElement.style.opacity = '0';
      }
    });

    // Update visual mask for subsequent renders
    setVisuallyHidden(prev => {
      const next = new Set(prev);
      next.add(channelId);
      return next;
    });

    // Set timeout to auto-unhide after 2 seconds (failsafe)
    const existingTimeout = timeoutsRef.current.get(channelId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      showBadgeNow(channelId);
    }, 2000);
    
    timeoutsRef.current.set(channelId, timeout);
  }, [showBadgeNow]);

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
          requestAnimationFrame(() => {
            const badgeElement = document.querySelector(`[data-badge-id="${channelId}"]`) as HTMLElement;
            if (badgeElement) {
              badgeElement.style.display = '';
              badgeElement.style.opacity = '';
            }
          });
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
    isBadgeHidden,
    resetAllState
  };
}