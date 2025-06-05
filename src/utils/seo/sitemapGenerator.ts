
import { supabase } from '@/lib/supabase';
import { SEO_CONFIG } from './seoConfig';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export const generateSitemap = async (): Promise<string> => {
  const urls: SitemapUrl[] = [];
  const baseUrl = SEO_CONFIG.siteUrl;
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Static pages
  const staticPages = [
    { path: '', priority: 1.0, changefreq: 'weekly' as const },
    { path: '/contact', priority: 0.8, changefreq: 'monthly' as const },
    { path: '/legal', priority: 0.5, changefreq: 'yearly' as const },
  ];
  
  // Add static pages for each language
  staticPages.forEach(page => {
    // Default English version
    urls.push({
      loc: `${baseUrl}${page.path}`,
      lastmod: currentDate,
      changefreq: page.changefreq,
      priority: page.priority
    });
    
    // Spanish version
    urls.push({
      loc: `${baseUrl}${page.path}?lang=es`,
      lastmod: currentDate,
      changefreq: page.changefreq,
      priority: page.priority * 0.9
    });
    
    // Georgian version
    urls.push({
      loc: `${baseUrl}${page.path}?lang=ka`,
      lastmod: currentDate,
      changefreq: page.changefreq,
      priority: page.priority * 0.9
    });
  });
  
  try {
    // Get business profiles for dynamic pages
    const { data: businesses, error } = await supabase
      .from('business_profiles')
      .select('slug, updated_at')
      .not('slug', 'is', null);
    
    if (!error && businesses) {
      businesses.forEach(business => {
        const lastmod = business.updated_at ? 
          new Date(business.updated_at).toISOString().split('T')[0] : 
          currentDate;
        
        // Add business page for each language
        ['', '?lang=es', '?lang=ka'].forEach((langParam, index) => {
          urls.push({
            loc: `${baseUrl}/business/${business.slug}${langParam}`,
            lastmod,
            changefreq: 'weekly',
            priority: 0.7 * (index === 0 ? 1 : 0.9)
          });
        });
      });
    }
  } catch (error) {
    console.error('Error fetching business profiles for sitemap:', error);
  }
  
  // Generate XML sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(url => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority ? `<priority>${url.priority.toFixed(1)}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`;
  
  return sitemap;
};

const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

export const updateSitemap = async (): Promise<boolean> => {
  try {
    const sitemapContent = await generateSitemap();
    
    // In a real deployment, you would write this to public/sitemap.xml
    // For now, we'll log it and it can be manually saved
    console.log('Generated sitemap:', sitemapContent);
    
    // You could also send this to a backend endpoint to save the file
    // or use a service worker to cache it
    
    return true;
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return false;
  }
};
