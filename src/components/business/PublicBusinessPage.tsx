import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { forceBucketCreation } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoaderCircle, Globe, Mail, Phone, MapPin, Clock } from "lucide-react";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { BusinessSEO } from './BusinessSEO';
import { WorkingHoursConfig, DAYS_OF_WEEK, DayOfWeek } from "@/types/workingHours";

export const PublicBusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isGeorgian = language === 'ka';
  
  // Set the flag to prevent authentication redirects
  useEffect(() => {
    localStorage.setItem('accessing_public_business_page', 'true');
    localStorage.setItem('last_business_path', location.pathname);
    
    return () => {
      // Only remove the flag if we're navigating away from business pages
      if (!location.pathname.startsWith('/business')) {
        localStorage.removeItem('accessing_public_business_page');
      }
    };
  }, [location.pathname]);
  
  const getBusinessSlug = () => {
    // Check for slug in URL path parameters
    if (slug) return slug;
    
    // Check for slug in pathname (e.g., /business/slug-name)
    const pathMatch = location.pathname.match(/\/business\/([^\/]+)/);
    if (pathMatch && pathMatch[1]) return pathMatch[1];
    
    // Check for slug in query parameters
    const searchParams = new URLSearchParams(location.search);
    const slugFromSearch = searchParams.get('slug') || searchParams.get('business');
    if (slugFromSearch) return slugFromSearch;
    
    // Fall back to cached slug (if any)
    const cachedSlug = localStorage.getItem('lastVisitedBusinessSlug');
    if (cachedSlug) return cachedSlug;
    
    return null;
  };

  const businessSlug = getBusinessSlug();

  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imageRetryCount = useRef(0);
  const maxRetryCount = 3;

  console.log("[PublicBusinessPage] Using business slug:", businessSlug);
  console.log("[PublicBusinessPage] Current theme:", theme);
  console.log("[PublicBusinessPage] Current path:", location.pathname);
  console.log("[PublicBusinessPage] Current URL:", window.location.href);

  // Fast loading - removed slow retry logic

  // Cache the business slug for future visits
  useEffect(() => {
    if (businessSlug) {
      localStorage.setItem('lastVisitedBusinessSlug', businessSlug);
    }
  }, [businessSlug]);

  // Fetch the business profile - optimized for fast loading
  useEffect(() => {
    const fetchBusinessProfile = async () => {
      if (!businessSlug) {
        setError("No business slug provided");
        setIsLoading(false);
        return;
      }
      
      try {
        // Check cache first for instant loading
        const cachedBusiness = sessionStorage.getItem(`business_profile_${businessSlug}`);
        if (cachedBusiness) {
          try {
            const parsed = JSON.parse(cachedBusiness);
            // Parse working_hours properly from cache too
            const parsedCached: BusinessProfile = {
              ...parsed,
              working_hours: parsed.working_hours as WorkingHoursConfig | null
            } as BusinessProfile;
            setBusiness(parsedCached);
            if (parsed.cover_photo_url) {
              setCoverPhotoUrl(parsed.cover_photo_url);
            }
            setIsLoading(false);
          } catch (e) {
            console.log("Invalid cached data, fetching fresh");
          }
        }
        
        console.log("[PublicBusinessPage] Fetching business profile for slug:", businessSlug);
        
        // Parallel fetch - try both exact and case-insensitive at once
        const [exactMatch, caseInsensitiveMatch] = await Promise.allSettled([
          supabase.from("business_profiles").select("*").eq("slug", businessSlug).maybeSingle(),
          supabase.from("business_profiles").select("*").ilike("slug", businessSlug).maybeSingle()
        ]);
        
        let data = null;
        let error = null;
        
        if (exactMatch.status === 'fulfilled' && exactMatch.value.data) {
          data = exactMatch.value.data;
        } else if (caseInsensitiveMatch.status === 'fulfilled' && caseInsensitiveMatch.value.data) {
          data = caseInsensitiveMatch.value.data;
        } else {
          // Use the first error if both failed
          if (exactMatch.status === 'fulfilled') {
            error = exactMatch.value.error;
          } else if (caseInsensitiveMatch.status === 'fulfilled') {
            error = caseInsensitiveMatch.value.error;
          }
        }

        if (error && !data) {
          console.error("Error fetching business profile:", error);
          setError(`Database error: ${error.message}`);
          return;
        }
        
        if (!data) {
          console.error("No business found with slug:", businessSlug);
          setError("Business not found");
          return;
        }
        
        console.log("[PublicBusinessPage] Fetched business profile:", data);
        
        // Parse working_hours from JSON if it exists
        const parsedBusiness: BusinessProfile = {
          ...data,
          working_hours: data.working_hours as WorkingHoursConfig | null
        } as BusinessProfile;
        
        setBusiness(parsedBusiness);
        
        // Cache the business profile for fast subsequent loads
        try {
          sessionStorage.setItem(`business_profile_${businessSlug}`, JSON.stringify(data));
        } catch (e) {
          // Ignore cache storage errors
        }
        
        if (data?.cover_photo_url) {
          setCoverPhotoUrl(data.cover_photo_url);
          setImageLoaded(false);
          imageRetryCount.current = 0;
        }
        
        if (data?.business_name) {
          document.title = `${data.business_name} - Book Now`;
          
          // Update meta tags for better SEO
          const metaDescription = document.querySelector('meta[name="description"]');
          if (metaDescription) {
            metaDescription.setAttribute('content', `Book appointments with ${data.business_name}. ${data.description || 'Online booking available.'}`);
          }
          
          const ogTitle = document.querySelector('meta[property="og:title"]');
          if (ogTitle) {
            ogTitle.setAttribute('content', `${data.business_name} - Book Now | Smartbookly`);
          }
          
          const ogDescription = document.querySelector('meta[property="og:description"]');
          if (ogDescription) {
            ogDescription.setAttribute('content', `Book appointments with ${data.business_name}. ${data.description || 'Online booking available.'}`);
          }
        }
      } catch (error) {
        console.error("Exception in fetchBusinessProfile:", error);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessProfile();
  }, [businessSlug]);

  const handleImageLoad = () => {
    console.log("[PublicBusinessPage] Cover photo loaded successfully");
    setImageLoaded(true);
    imageRetryCount.current = 0;
  };

  const handleImageError = () => {
    console.error("[PublicBusinessPage] Error loading cover photo:", coverPhotoUrl);
    // Fast fallback - no retries to prevent slow loading
    setImageLoaded(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t("common.loading")}</span>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">{t("business.notFound")}</h1>
        <p className="text-center text-muted-foreground">
          {error || t("business.notFoundDescription")}
        </p>
        <Button className="mt-6" onClick={() => window.location.href = "/"}>
          {t("common.backToHome")}
        </Button>
      </div>
    );
  }

  const defaultCoverUrl = 'https://placehold.co/1200x400/e2e8f0/64748b?text=Business+Cover';
  const displayCoverUrl = coverPhotoUrl || defaultCoverUrl;

  // Add this function to ensure proper font rendering for Georgian text
  const applyGeorgianFont = (isGeorgian: boolean) => {
    return isGeorgian ? {
      fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"
    } : undefined;
  };

  return (
    <div className="min-h-screen bg-background">
      {business && <BusinessSEO business={business} />}
      
      {/* Header controls with semi-transparent background for visibility on cover */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      
      {/* Hero section with cover photo - optimized loading */}
      <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white dark:from-blue-800 dark:to-indigo-900"
        style={{
          backgroundImage: imageLoaded ? `url(${displayCoverUrl})` : `url(${defaultCoverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '44vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        
        <div className="container mx-auto px-4 relative h-full flex flex-col justify-end">
          {/* Business info moved lower in the cover section */}
          <div className="py-16 mb-16">
            {/* Business name with optional avatar */}
            <div className="flex items-center gap-4 mb-6">
              {business.avatar_url && (
                <img
                  src={business.avatar_url}
                  alt={`${business.business_name} logo`}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-white shadow-lg"
                />
              )}
              <h1 
                className={cn("text-4xl md:text-5xl font-bold", isGeorgian ? "font-georgian" : "")}
                style={applyGeorgianFont(isGeorgian)}
              >
                {business.business_name}
              </h1>
            </div>
            {business.description && (
              <p 
                className={cn("text-lg opacity-90 max-w-2xl mb-8", isGeorgian ? "font-georgian" : "")}
                style={applyGeorgianFont(isGeorgian)}
              >
                {business.description}
              </p>
            )}
            
            <div className="flex gap-4 mb-6">
              <Button 
                size="lg" 
                className={cn("bg-white text-blue-700 hover:bg-blue-50 dark:bg-white/90 dark:hover:bg-white", isGeorgian ? "georgian-text-fix font-georgian" : "")}
                style={applyGeorgianFont(isGeorgian)}
                onClick={() => {
                  document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <LanguageText withFont={true}>{t("calendar.bookNow")}</LanguageText>
              </Button>
            </div>
          </div>
        </div>
          
        {/* Contact information moved to bottom of the hero section as requested */}
        <div className="bg-white/15 backdrop-blur-sm mt-auto dark:bg-black/30">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-6 py-4">
              {business.contact_email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-100" />
                  <a href={`mailto:${business.contact_email}`} className="hover:underline text-white">
                    {business.contact_email}
                  </a>
                </div>
              )}
              
              {business.contact_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-blue-100" />
                  <a href={`tel:${business.contact_phone}`} className="hover:underline text-white">
                    {business.contact_phone}
                  </a>
                </div>
              )}
              
              {business.contact_address && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-blue-100" />
                  <span className="text-white">{business.contact_address}</span>
                </div>
              )}
              
              {business.contact_website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-blue-100" />
                  <a 
                    href={business.contact_website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline text-white"
                  >
                    {business.contact_website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              
              {/* Working Hours Display */}
              {business.working_hours?.enabled && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <Clock className="h-5 w-5 text-blue-100 mt-0.5" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-white text-sm">
                    {DAYS_OF_WEEK.map((day) => {
                      const dayConfig = business.working_hours?.days?.[day as DayOfWeek];
                      if (!dayConfig?.enabled) return null;
                      return (
                        <span key={day} className="whitespace-nowrap">
                          {t(`calendar.days.${day}`)}: {dayConfig.start} - {dayConfig.end}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {coverPhotoUrl && (
        <img 
          src={coverPhotoUrl} 
          alt=""
          className="hidden" 
          loading="eager"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}

      <div className="container mx-auto px-4 py-6">
        <div id="calendar-section" className="bg-background">
          <div className={cn(
            "flex justify-between items-center mb-3 sm:mb-4",
            isGeorgian && "flex-col sm:flex-row gap-1 sm:gap-0"
          )}>
            <h2 
              className={cn("text-lg sm:text-2xl font-bold leading-tight", isGeorgian ? "font-georgian" : "")}
              style={applyGeorgianFont(isGeorgian)}
            >
              <LanguageText>{t("business.availableTimes")}</LanguageText>
            </h2>
            <div 
              className={cn(
                "text-sm text-muted-foreground",
                isGeorgian ? "font-georgian ml-0 sm:ml-4" : ""
              )}
              style={applyGeorgianFont(isGeorgian)}
            >
              <LanguageText>{t("business.clickToRequest")}</LanguageText>
            </div>
          </div>
          
          {business.id && (
            <ExternalCalendar businessId={business.id} workingHours={business.working_hours} />
          )}
        </div>
      </div>
    </div>
  );
};
