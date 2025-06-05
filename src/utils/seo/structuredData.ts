
import { SEO_CONFIG } from './seoConfig';

export const generateOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Smartbookly",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": SEO_CONFIG.defaultDescription,
  "url": SEO_CONFIG.siteUrl,
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free trial available"
  },
  "featureList": [
    "CRM Management",
    "Online Booking System",
    "Task Management",
    "Calendar Integration",
    "Business Analytics"
  ]
});

export const generateBusinessSchema = (business: {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  type?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": business.name,
  "description": business.description,
  "address": business.address ? {
    "@type": "PostalAddress",
    "streetAddress": business.address
  } : undefined,
  "telephone": business.phone,
  "email": business.email,
  "url": business.website,
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Services",
    "itemListElement": [{
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": "Online Booking"
      }
    }]
  }
});

export const generateWebsiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Smartbookly",
  "url": SEO_CONFIG.siteUrl,
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${SEO_CONFIG.siteUrl}/business?search={search_term_string}`
    },
    "query-input": "required name=search_term_string"
  }
});
