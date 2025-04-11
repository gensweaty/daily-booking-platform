
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is defined (for SSR)
    if (typeof window !== 'undefined') {
      const media = window.matchMedia(query);
      // Set matches initially
      setMatches(media.matches);

      // Define listener function
      const listener = () => {
        setMatches(media.matches);
      };

      // Add the listener
      media.addEventListener('change', listener);
      
      // Clean up
      return () => media.removeEventListener('change', listener);
    }
    
    // Default to false in SSR
    return () => {};
  }, [query]);

  return matches;
}
