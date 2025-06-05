
interface MetaTag {
  name?: string;
  property?: string;
  content: string;
  rel?: string;
  href?: string;
  hreflang?: string;
}

interface MetaTagsConfig {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  hreflang?: Array<{ lang: string; href: string }>;
  structuredData?: any;
}

export const updatePageMetaTags = (config: MetaTagsConfig) => {
  // Update title
  document.title = config.title;
  
  // Remove existing meta tags
  const existingMetas = document.querySelectorAll('meta[data-seo="true"]');
  existingMetas.forEach(meta => meta.remove());
  
  // Remove existing canonical links
  const existingCanonical = document.querySelectorAll('link[rel="canonical"]');
  existingCanonical.forEach(link => link.remove());
  
  // Remove existing hreflang links
  const existingHreflang = document.querySelectorAll('link[rel="alternate"]');
  existingHreflang.forEach(link => link.remove());
  
  const metaTags: MetaTag[] = [
    { name: 'description', content: config.description },
  ];
  
  if (config.keywords) {
    metaTags.push({ name: 'keywords', content: config.keywords });
  }
  
  if (config.ogTitle) {
    metaTags.push({ property: 'og:title', content: config.ogTitle });
  }
  
  if (config.ogDescription) {
    metaTags.push({ property: 'og:description', content: config.ogDescription });
  }
  
  if (config.ogImage) {
    metaTags.push({ property: 'og:image', content: config.ogImage });
  }
  
  // Add meta tags
  metaTags.forEach(tag => {
    const meta = document.createElement('meta');
    if (tag.name) meta.setAttribute('name', tag.name);
    if (tag.property) meta.setAttribute('property', tag.property);
    meta.setAttribute('content', tag.content);
    meta.setAttribute('data-seo', 'true');
    document.head.appendChild(meta);
  });
  
  // Add canonical URL
  if (config.canonicalUrl) {
    const canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    canonical.setAttribute('href', config.canonicalUrl);
    document.head.appendChild(canonical);
  }
  
  // Add hreflang links
  if (config.hreflang) {
    config.hreflang.forEach(({ lang, href }) => {
      const hreflang = document.createElement('link');
      hreflang.setAttribute('rel', 'alternate');
      hreflang.setAttribute('hreflang', lang);
      hreflang.setAttribute('href', href);
      document.head.appendChild(hreflang);
    });
  }
  
  // Add structured data
  if (config.structuredData) {
    // Remove existing structured data
    const existingStructuredData = document.querySelectorAll('script[type="application/ld+json"]');
    existingStructuredData.forEach(script => script.remove());
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(config.structuredData);
    document.head.appendChild(script);
  }
};

export const generateBusinessMetaTags = (business: any) => {
  return {
    title: `${business.business_name} - Book Now | Smartbookly`,
    description: business.description 
      ? `Book appointments with ${business.business_name}. ${business.description}` 
      : `Book appointments with ${business.business_name}. Online booking available.`,
    keywords: `${business.business_name}, booking, appointments, online scheduling`,
    ogTitle: `${business.business_name} - Book Now | Smartbookly`,
    ogDescription: business.description 
      ? `Book appointments with ${business.business_name}. ${business.description}` 
      : `Book appointments with ${business.business_name}. Online booking available.`,
    ogImage: business.cover_photo_url || '/og-image.png'
  };
};
