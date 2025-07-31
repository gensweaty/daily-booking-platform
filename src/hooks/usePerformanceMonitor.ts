
import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
}

export const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const measurePerformance = () => {
      // Wait for page load to complete
      if (document.readyState !== 'complete') {
        window.addEventListener('load', measurePerformance);
        return;
      }

      // Get navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      // Get paint timing
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0;
      const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;

      // Get LCP using Performance Observer
      let largestContentfulPaint = 0;
      
      if ('PerformanceObserver' in window) {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          largestContentfulPaint = lastEntry.startTime;
        });
        
        try {
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
          console.warn('LCP observation not supported');
        }
      }

      // Calculate load time
      const loadTime = navigation.loadEventEnd - navigation.navigationStart;

      const performanceMetrics: PerformanceMetrics = {
        loadTime,
        firstPaint,
        firstContentfulPaint,
        largestContentfulPaint,
        cumulativeLayoutShift: 0 // Would need more complex measurement
      };

      setMetrics(performanceMetrics);
      setIsLoading(false);

      // Log performance metrics for debugging
      console.log('Performance Metrics:', performanceMetrics);
    };

    measurePerformance();

    return () => {
      window.removeEventListener('load', measurePerformance);
    };
  }, []);

  return { metrics, isLoading };
};
