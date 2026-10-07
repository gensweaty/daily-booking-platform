import { lazy, ComponentType } from 'react';

const RELOAD_KEY = 'chunk-reload-at';

/**
 * Lazy import that survives stale chunk hashes after a new deploy.
 * On a failed dynamic import it reloads the page once (max 1 per 10s).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Keep the promise pending while the page reloads.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
