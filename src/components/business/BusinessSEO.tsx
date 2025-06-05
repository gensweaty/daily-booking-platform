
import { useEffect } from 'react';
import { generateBusinessMetaTags } from '@/utils/seo/metaTags';
import { generateBusinessSchema } from '@/utils/seo/structuredData';
import { updatePageMetaTags } from '@/utils/seo/metaTags';
import { SEO_CONFIG } from '@/utils/seo/seoConfig';
import { BusinessProfile } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';

interface BusinessSEOProps {
  business: BusinessProfile;
}

export const BusinessSEO = ({ business }: BusinessSEOProps) => {
  const { language } = useLanguage();
  
  useEffect(() => {
    if (!business) return;
    
    const title = `${business.business_name} - Book Now | Smartbookly`;
    const description = business.description 
      ? `Book appointments with ${business.business_name}. ${business.description}` 
      : `Book appointments with ${business.business_name}. Online booking available.`;
    
    // Generate structured data for the business
    const businessSchema = generateBusinessSchema({
      name: business.business_name,
      description: business.description || undefined,
      address: business.contact_address || undefined,
      phone: business.contact_phone || undefined,
      email: business.contact_email || undefined,
      website: business.contact_website || undefined,
      type: 'LocalBusiness'
    });
    
    // Generate hreflang links for business page
    const businessSlug = business.slug;
    const hreflangLinks = Object.keys(SEO_CONFIG.languages).map(lang => ({
      lang: lang === 'en' ? 'x-default' : lang,
      href: `${SEO_CONFIG.siteUrl}/business/${businessSlug}${lang !== 'en' ? `?lang=${lang}` : ''}`
    }));
    
    // Update meta tags
    updatePageMetaTags({
      title,
      description,
      keywords: `${business.business_name}, business, booking, appointments, online scheduling`,
      ogTitle: title,
      ogDescription: description,
      ogImage: business.cover_photo_url || '/og-image.png',
      canonicalUrl: `${SEO_CONFIG.siteUrl}/business/${businessSlug}`,
      hreflang: hreflangLinks,
      structuredData: businessSchema
    });
    
  }, [business, language]);
  
  return null;
};
