
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { updatePageMetaTags } from '@/utils/seo/metaTags';
import { generateOrganizationSchema, generateWebsiteSchema } from '@/utils/seo/structuredData';
import { SEO_CONFIG } from '@/utils/seo/seoConfig';

export const SEOManager = () => {
  const location = useLocation();
  const { language } = useLanguage();
  
  useEffect(() => {
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const currentLang = searchParams.get('lang') || language;
    
    // Get language-specific configuration
    const langConfig = SEO_CONFIG.languages[currentLang as keyof typeof SEO_CONFIG.languages] || SEO_CONFIG.languages.en;
    
    // Generate hreflang links
    const hreflangLinks = Object.keys(SEO_CONFIG.languages).map(lang => ({
      lang: lang === 'en' ? 'x-default' : lang,
      href: `${SEO_CONFIG.siteUrl}${currentPath}${lang !== 'en' ? `?lang=${lang}` : ''}`
    }));
    
    // Add x-default for English
    hreflangLinks.push({
      lang: 'x-default',
      href: `${SEO_CONFIG.siteUrl}${currentPath}`
    });
    
    let title = langConfig.title;
    let description = langConfig.description;
    let structuredData: any = generateOrganizationSchema();
    
    // Page-specific SEO
    if (currentPath === '/contact') {
      const contactConfig = SEO_CONFIG.pages.contact[currentLang as keyof typeof SEO_CONFIG.pages.contact];
      if (contactConfig) {
        title = contactConfig.title;
        description = contactConfig.description;
      }
    } else if (currentPath === '/legal') {
      const legalConfig = SEO_CONFIG.pages.legal[currentLang as keyof typeof SEO_CONFIG.pages.legal];
      if (legalConfig) {
        title = legalConfig.title;
        description = legalConfig.description;
      }
    } else if (currentPath === '/') {
      // Homepage gets website schema
      structuredData = generateWebsiteSchema();
    }
    
    // Update meta tags
    updatePageMetaTags({
      title,
      description,
      keywords: langConfig.keywords,
      canonicalUrl: `${SEO_CONFIG.siteUrl}${currentPath}`,
      hreflang: hreflangLinks,
      structuredData
    });
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLang;
    
  }, [location.pathname, location.search, language]);
  
  return null;
};
