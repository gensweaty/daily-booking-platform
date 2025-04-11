
import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase, forceBucketCreation } from "@/lib/supabase";
import { BusinessProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoaderCircle, Globe, Mail, Phone, MapPin } from "lucide-react";
import { ExternalCalendar } from "../Calendar/ExternalCalendar";

export const PublicBusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  
  // More robust slug extraction that handles multiple URL formats
  const getBusinessSlug = () => {
    // First try from URL params
    if (slug) return slug;
    
    // Then try to extract from path
    const pathMatch = location.pathname.match(/\/business\/([^\/]+)/);
    if (pathMatch && pathMatch[1]) return pathMatch[1];
    
    // Try to extract from URL search params
    const searchParams = new URLSearchParams(location.search);
    const slugFromSearch = searchParams.get('slug') || searchParams.get('business');
    if (slugFromSearch) return slugFromSearch;
    
    // Last resort, check local storage
    return localStorage.getItem('lastVisitedBusinessSlug') || null;
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

  // Set up a refresh interval to periodically refetch the business profile
  useEffect(() => {
    // Set up an interval to trigger refreshes
    const intervalId = setInterval(() => {
      if (retryCount < 3 && !business) {
        setRetryCount(prev => prev + 1);
      }
    }, 5000); // Retry every 5 seconds for first 15 seconds
    
    return () => clearInterval(intervalId);
  }, [business, retryCount]);

  // Save business slug to localStorage when found for recovery
  useEffect(() => {
    if (businessSlug) {
      localStorage.setItem('lastVisitedBusinessSlug', businessSlug);
    }
  }, [businessSlug]);

  useEffect(() => {
    const fetchBusinessProfile = async () => {
      if (!businessSlug) {
        setError("No business slug provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log("[PublicBusinessPage] Fetching business profile for slug:", businessSlug);
        
        // Ensure storage buckets exist
        await forceBucketCreation();
        
        const { data, error } = await supabase
          .from("business_profiles")
          .select("*")
          .eq("slug", businessSlug)
          .single();

        if (error) {
          console.error("Error fetching business profile:", error);
          setError("Failed to load business information");
          return;
        }
        
        if (!data) {
          console.error("No business found with slug:", businessSlug);
          setError("Business not found");
          return;
        }
        
        console.log("[PublicBusinessPage] Fetched business profile:", data);
        setBusiness(data as BusinessProfile);
        
        // Set the cover photo URL with a cache-busting parameter
        if (data.cover_photo_url) {
          // Skip blob URLs which are temporary
          if (!data.cover_photo_url.startsWith('blob:')) {
            // Always add a fresh timestamp query parameter
            const timestamp = Date.now();
            let photoUrl = data.cover_photo_url.split('?')[0]; // Remove any existing parameters
            photoUrl = `${photoUrl}?t=${timestamp}`;
            
            console.log("[PublicBusinessPage] Setting cover photo URL with cache busting:", photoUrl);
            setCoverPhotoUrl(photoUrl);
            // Reset image loaded state
            setImageLoaded(false);
            // Reset retry count
            imageRetryCount.current = 0;
          } else {
            console.warn("[PublicBusinessPage] Ignoring blob URL:", data.cover_photo_url);
            setCoverPhotoUrl(null);
          }
        }
        
        if (data?.business_name) {
          document.title = `${data.business_name} - Book Now`;
        }
      } catch (error) {
        console.error("Exception in fetchBusinessProfile:", error);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessProfile();
  }, [businessSlug, retryCount]); // Also refetch when retryCount changes

  // Handle image load success
  const handleImageLoad = () => {
    console.log("[PublicBusinessPage] Cover photo loaded successfully");
    setImageLoaded(true);
    // Reset retry count on successful load
    imageRetryCount.current = 0;
  };

  // Handle image load error and retry with a new URL if needed
  const handleImageError = () => {
    console.error("[PublicBusinessPage] Error loading cover photo:", coverPhotoUrl);
    
    // Only retry a limited number of times to prevent infinite loops
    if (imageRetryCount.current < maxRetryCount && business?.cover_photo_url && !business.cover_photo_url.startsWith('blob:')) {
      imageRetryCount.current++;
      
      // Generate a new URL with a fresh timestamp
      const baseUrl = business.cover_photo_url.split('?')[0]; // Remove any existing query parameters
      const refreshedUrl = `${baseUrl}?t=${Date.now()}&retry=${imageRetryCount.current}`;
      console.log(`[PublicBusinessPage] Retry #${imageRetryCount.current} with refreshed URL:`, refreshedUrl);
      
      // Set a small delay before retrying to avoid hammering the server
      setTimeout(() => {
        setCoverPhotoUrl(refreshedUrl);
      }, 1000); 
    } else {
      // Fall back to the default cover after max retries
      console.log("[PublicBusinessPage] Max retries reached, using default cover");
      setImageLoaded(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading business calendar...</span>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">Business Not Found</h1>
        <p className="text-center text-muted-foreground">
          {error || "Sorry, we couldn't find a business with this URL. Please check the URL and try again."}
        </p>
        <Button className="mt-6" onClick={() => window.location.href = "/"}>
          Back to Homepage
        </Button>
      </div>
    );
  }

  console.log("[PublicBusinessPage] Rendering calendar for business ID:", business.id);

  // Use the stored coverPhotoUrl state instead of relying on businessProfile directly
  const defaultCoverUrl = 'https://placehold.co/1200x400/e2e8f0/64748b?text=Business+Cover';
  const displayCoverUrl = coverPhotoUrl || defaultCoverUrl;

  return (
    <div className="min-h-screen bg-background">
      <div 
        className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16"
        style={{
          backgroundImage: `url(${displayCoverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay for text readability when cover photo is present */}
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        
        <div className="container mx-auto px-4 relative">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{business.business_name}</h1>
          {business.description && <p className="text-lg opacity-90 max-w-2xl">{business.description}</p>}
          
          <div className="flex gap-4 mt-6">
            <Button 
              size="lg" 
              className="bg-white text-blue-700 hover:bg-blue-50"
              onClick={() => {
                document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              View & Book Calendar
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden image preloader to ensure the image is properly loaded and cached */}
      {coverPhotoUrl && (
        <img 
          src={coverPhotoUrl} 
          alt=""
          className="hidden" 
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      )}

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8" id="calendar-section">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Available Times</h2>
            <div className="text-sm text-muted-foreground">
              Click on any time slot to request a booking
            </div>
          </div>
          
          {business.id && (
            <ExternalCalendar businessId={business.id} />
          )}
        </div>

        <div className="mt-12">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold">Contact Information</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {business.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <a href={`mailto:${business.contact_email}`} className="hover:underline">
                      {business.contact_email}
                    </a>
                  </div>
                )}
                
                {business.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <a href={`tel:${business.contact_phone}`} className="hover:underline">
                      {business.contact_phone}
                    </a>
                  </div>
                )}
                
                {business.contact_address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <span>{business.contact_address}</span>
                  </div>
                )}
                
                {business.contact_website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <a 
                      href={business.contact_website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {business.contact_website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
