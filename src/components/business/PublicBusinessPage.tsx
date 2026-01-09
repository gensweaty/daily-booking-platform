import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { forceBucketCreation } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoaderCircle, Globe, Mail, Phone, MapPin, Clock, Calendar, ChevronDown, Copy, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { BusinessSEO } from './BusinessSEO';
import { WorkingHoursConfig, DAYS_OF_WEEK, DayOfWeek } from "@/types/workingHours";
import { motion } from "framer-motion";

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

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const contactItemVariant = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-background">
      {business && <BusinessSEO business={business} />}
      
      {/* Header controls with glassmorphism effect */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full px-4 py-2.5 shadow-lg"
      >
        <ThemeToggle />
        <div className="w-px h-5 bg-white/30" />
        <LanguageSwitcher />
      </motion.div>
      
      {/* Hero section with enhanced design */}
      <div className="relative min-h-[60vh] md:min-h-[65vh] overflow-hidden">
        {/* Background image with better overlay */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-accent/80"
          style={{
            backgroundImage: imageLoaded ? `url(${displayCoverUrl})` : `url(${defaultCoverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        
        {/* Enhanced gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        
        {/* Subtle pattern overlay for texture */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
        
        {/* Main content container */}
        <div className="relative h-full min-h-[60vh] md:min-h-[65vh] flex flex-col justify-end">
          <div className="container mx-auto px-4 md:px-6 pb-8">
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="max-w-3xl"
            >
              {/* Avatar and business name - vertical layout */}
              <motion.div variants={fadeInUp} className="flex flex-col items-start mb-4">
                {business.avatar_url && (
                  <div className="relative mb-4">
                    <div className="absolute inset-0 rounded-full bg-primary/50 blur-xl animate-pulse" />
                    <img
                      src={business.avatar_url}
                      alt={`${business.business_name} logo`}
                      className="relative w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-white/30 shadow-2xl ring-4 ring-white/10"
                    />
                  </div>
                )}
                <h1 
                  className={cn(
                    "text-3xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight",
                    isGeorgian ? "font-georgian" : ""
                  )}
                  style={applyGeorgianFont(isGeorgian)}
                >
                  {business.business_name}
                </h1>
              </motion.div>
              
              {/* Description */}
              {business.description && (
                <motion.p 
                  variants={fadeInUp}
                  className={cn(
                    "text-lg md:text-xl text-white/80 max-w-2xl mb-6 leading-relaxed",
                    isGeorgian ? "font-georgian" : ""
                  )}
                  style={applyGeorgianFont(isGeorgian)}
                >
                  {business.description}
                </motion.p>
              )}
              
              {/* CTA Button */}
              <motion.div variants={fadeInUp} className="flex flex-wrap gap-3 mb-8">
                <Button 
                  size="lg" 
                  className={cn(
                    "group relative overflow-hidden bg-white text-primary hover:bg-white/95 shadow-xl shadow-black/20 font-semibold px-8 py-6 text-lg rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl",
                    isGeorgian ? "georgian-text-fix font-georgian" : ""
                  )}
                  style={applyGeorgianFont(isGeorgian)}
                  onClick={() => {
                    document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Calendar className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" />
                  <LanguageText withFont={true}>{t("calendar.bookNow")}</LanguageText>
                </Button>
              </motion.div>
            </motion.div>
          </div>
          
          {/* Scroll indicator */}
          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            onClick={() => {
              document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <span className="text-xs uppercase tracking-widest">{t("common.scroll") || "Scroll"}</span>
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </motion.button>
        </div>
      </div>
      
      {/* Contact Information Bar - Modern glassmorphism design */}
      <div id="contact-section" className="bg-card/50 dark:bg-card/30 backdrop-blur-xl border-y border-border/50">
        <div className="container mx-auto px-4 md:px-6 py-6">
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {business.contact_email && (
              <Popover>
                <PopoverTrigger asChild>
                  <motion.button 
                    variants={contactItemVariant}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-background/60 dark:bg-background/40 border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer text-left w-full"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t("business.email") || "Email"}</p>
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {business.contact_email}
                      </p>
                    </div>
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 bg-card border-border shadow-xl" align="start">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t("business.email") || "Email"}</p>
                    <p className="text-sm text-muted-foreground break-words">{business.contact_email}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          navigator.clipboard.writeText(business.contact_email || '');
                          toast.success(t("common.copied") || "Copied to clipboard");
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {t("common.copy") || "Copy"}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.location.href = `mailto:${business.contact_email}`}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {t("common.send") || "Send"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {business.contact_phone && (
              <Popover>
                <PopoverTrigger asChild>
                  <motion.button 
                    variants={contactItemVariant}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-background/60 dark:bg-background/40 border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer text-left w-full"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                      <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t("business.phone") || "Phone"}</p>
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                        {business.contact_phone}
                      </p>
                    </div>
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 bg-card border-border shadow-xl" align="start">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t("business.phone") || "Phone"}</p>
                    <p className="text-sm text-muted-foreground break-words">{business.contact_phone}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          navigator.clipboard.writeText(business.contact_phone || '');
                          toast.success(t("common.copied") || "Copied to clipboard");
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        {t("common.copy") || "Copy"}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.location.href = `tel:${business.contact_phone}`}
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        {t("common.call") || "Call"}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {business.contact_address && (
              <Popover>
                <PopoverTrigger asChild>
                  <motion.button 
                    variants={contactItemVariant}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-background/60 dark:bg-background/40 border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer text-left w-full"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                      <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t("business.address") || "Address"}</p>
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {business.contact_address}
                      </p>
                    </div>
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 bg-card border-border shadow-xl" align="start">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t("business.fullAddress") || "Full Address"}</p>
                    <p className="text-sm text-muted-foreground break-words">{business.contact_address}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        navigator.clipboard.writeText(business.contact_address || '');
                        toast.success(t("common.copied") || "Copied to clipboard");
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {t("common.copyAddress") || "Copy Address"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {business.contact_website && (
              <motion.a 
                variants={contactItemVariant}
                href={business.contact_website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-4 rounded-xl bg-background/60 dark:bg-background/40 border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{t("business.website") || "Website"}</p>
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {business.contact_website.replace(/^https?:\/\//, '')}
                  </p>
                </div>
              </motion.a>
            )}
          </motion.div>
          
          {/* Working Hours - Separate section with better layout */}
          {business.working_hours?.enabled && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 p-4 rounded-xl bg-background/60 dark:bg-background/40 border border-border/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-medium text-foreground">{t("business.workingHours") || "Working Hours"}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map((day) => {
                  const dayConfig = business.working_hours?.days?.[day as DayOfWeek];
                  if (!dayConfig?.enabled) return null;
                  return (
                    <div 
                      key={day} 
                      className="px-3 py-1.5 rounded-lg bg-muted/50 text-sm"
                    >
                      <span className="font-medium text-foreground">{t(`calendar.days.${day}`)}</span>
                      <span className="text-muted-foreground ml-2">{dayConfig.start} - {dayConfig.end}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
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

      {/* Calendar Section with enhanced styling */}
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div 
          id="calendar-section" 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="bg-background"
        >
          <div className={cn(
            "flex justify-between items-center mb-4 md:mb-6",
            isGeorgian && "flex-col sm:flex-row gap-2 sm:gap-0"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <h2 
                className={cn(
                  "text-xl sm:text-2xl md:text-3xl font-bold text-foreground",
                  isGeorgian ? "font-georgian" : ""
                )}
                style={applyGeorgianFont(isGeorgian)}
              >
                <LanguageText>{t("business.availableTimes")}</LanguageText>
              </h2>
            </div>
            <div 
              className={cn(
                "text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full",
                isGeorgian ? "font-georgian" : ""
              )}
              style={applyGeorgianFont(isGeorgian)}
            >
              <LanguageText>{t("business.clickToRequest")}</LanguageText>
            </div>
          </div>
          
          <div className="rounded-2xl border border-border/50 overflow-hidden shadow-sm bg-card/30">
            {business.id && (
              <ExternalCalendar businessId={business.id} workingHours={business.working_hours} />
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Footer with business branding */}
      <div className="border-t border-border/50 bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              {business.avatar_url && (
                <img
                  src={business.avatar_url}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <span className={cn("font-medium", isGeorgian ? "font-georgian" : "")} style={applyGeorgianFont(isGeorgian)}>
                {business.business_name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{t("business.poweredBy") || "Powered by"}</span>
              <a href="https://smartbookly.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                Smartbookly
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
