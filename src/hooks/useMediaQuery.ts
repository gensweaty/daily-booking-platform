
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const getInitial = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };

  // Initialize from matchMedia immediately to avoid first-render layout flashes.
  const [matches, setMatches] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    // Ensure we sync on mount (query might have changed between renders).
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Safari < 14 uses addListener/removeListener.
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    // Legacy Safari
    (media as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(listener);
    return () => {
      (media as unknown as { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener(listener);
    };
  }, [query]);

  return matches;
}
