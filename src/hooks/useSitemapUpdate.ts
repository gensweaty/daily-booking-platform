
import { useEffect } from 'react';
import { updateSitemap } from '@/utils/seo/sitemapGenerator';

export const useSitemapUpdate = () => {
  const triggerSitemapUpdate = async () => {
    try {
      await updateSitemap();
      console.log('Sitemap updated successfully');
    } catch (error) {
      console.error('Failed to update sitemap:', error);
    }
  };

  return { triggerSitemapUpdate };
};

// Auto-update sitemap when business profiles change
export const SitemapUpdater = () => {
  const { triggerSitemapUpdate } = useSitemapUpdate();

  useEffect(() => {
    // Update sitemap on app load
    triggerSitemapUpdate();
    
    // Set up periodic updates (optional)
    const interval = setInterval(triggerSitemapUpdate, 24 * 60 * 60 * 1000); // Daily
    
    return () => clearInterval(interval);
  }, [triggerSitemapUpdate]);

  return null;
};
