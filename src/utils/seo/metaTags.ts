
import { SEO_CONFIG } from './seoConfig';

export interface MetaTagsConfig {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  hreflang?: Array<{ lang: string; href: string }>;
  structuredData?: object;
}

export const generateMetaTags = (config: MetaTagsConfig) => {
  const metaTags: Array<{ name?: string; property?: string; content: string; rel?: string; href?: string; hreflang?: string }> = [];
  
  // Basic meta tags
  metaTags.push({ name: 'description', content: config.description });
  if (config.keywords) {
    metaTags.push({ name: 'keywords', content: config.keywords });
  }
  
  // Open Graph tags
  metaTags.push({ property: 'og:title', content: config.ogTitle || config.title });
  metaTags.push({ property: 'og:description', content: config.ogDescription || config.description });
  metaTags.push({ property: 'og:type', content: 'website' });
  metaTags.push({ property: 'og:image', content: config.ogImage || '/og-image.png' });
  
  // Twitter tags
  metaTags.push({ name: 'twitter:card', content: 'summary_large_image' });
  metaTags.push({ name: 'twitter:title', content: config.ogTitle || config.title });
  metaTags.push({ name: 'twitter:description', content: config.ogDescription || config.description });
  
  // Canonical URL
  if (config.canonicalUrl) {
    metaTags.push({ rel: 'canonical', href: config.canonicalUrl });
  }
  
  return metaTags;
};

export const generateBusinessMetaTags = (businessName: string, businessDescription?: string, businessType?: string, language: string = 'en') => {
  const langConfig = SEO_CONFIG.languages[language as keyof typeof SEO_CONFIG.languages];
  const title = `${businessName} - Book Now | Smartbookly`;
  const description = businessDescription 
    ? `Book appointments with ${businessName}. ${businessDescription}` 
    : `Book appointments with ${businessName}. Online booking available.`;
  
  return generateMetaTags({
    title,
    description,
    keywords: `${businessName}, ${businessType || 'business'}, booking, appointments, ${langConfig.keywords}`,
    ogTitle: title,
    ogDescription: description,
    canonicalUrl: `${SEO_CONFIG.siteUrl}/business/${businessName.toLowerCase().replace(/\s+/g, '-')}`
  });
};

export const updatePageMetaTags = (config: MetaTagsConfig) => {
  // Update document title
  document.title = config.title;
  
  // Update existing meta tags or create new ones
  const metaTags = generateMetaTags(config);
  
  metaTags.forEach(tag => {
    let element: HTMLMetaElement | HTMLLinkElement | null = null;
    
    if (tag.name) {
      element = document.querySelector(`meta[name="${tag.name}"]`);
    } else if (tag.property) {
      element = document.querySelector(`meta[property="${tag.property}"]`);
    } else if (tag.rel) {
      element = document.querySelector(`link[rel="${tag.rel}"]`);
    }
    
    if (element) {
      if (tag.content) element.setAttribute('content', tag.content);
      if (tag.href) element.setAttribute('href', tag.href);
    } else {
      const newElement = document.createElement(tag.rel ? 'link' : 'meta');
      Object.entries(tag).forEach(([key, value]) => {
        if (value) newElement.setAttribute(key, value);
      });
      document.head.appendChild(newElement);
    }
  });
  
  // Add hreflang tags
  if (config.hreflang) {
    // Remove existing hreflang tags
    document.querySelectorAll('link[hreflang]').forEach(el => el.remove());
    
    config.hreflang.forEach(({ lang, href }) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang;
      link.href = href;
      document.head.appendChild(link);
    });
  }
  
  // Add structured data
  if (config.structuredData) {
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.textContent = JSON.stringify(config.structuredData);
    } else {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(config.structuredData);
      document.head.appendChild(script);
    }
  }
};
