
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getBusinessBySlug } from '@/lib/api';
import { Business } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/Calendar/Calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useCombinedEvents } from '@/hooks/useCombinedEvents';

export const PublicBusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  
  // Fetch business data
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!slug) return;
      
      try {
        const businessData = await getBusinessBySlug(slug);
        console.log("[PublicBusinessPage] Fetched business:", businessData?.id);
        setBusiness(businessData);
      } catch (error) {
        console.error("[PublicBusinessPage] Error fetching business:", error);
      } finally {
        setLoadingBusiness(false);
      }
    };
    
    fetchBusiness();
  }, [slug]);
  
  // Use our combined events hook to get events, including both direct events and approved requests
  const { events: allEvents, isLoading: loadingEvents, refetch } = useCombinedEvents(business?.id);
  
  // Force refetch when business ID is available to ensure we have updated data
  useEffect(() => {
    if (business?.id) {
      console.log("[PublicBusinessPage] Business ID is available, forcing refetch");
      refetch();
    }
  }, [business?.id, refetch]);
  
  if (loadingBusiness) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-12 w-1/2" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <div className="mt-6">
                <Skeleton className="h-96 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!business) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-2xl font-bold text-center">Business not found</h1>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  console.log(`[PublicBusinessPage] Rendering with ${allEvents?.length || 0} events for business ${business.id}`);
  
  return (
    <LanguageProvider>
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <h1 className="text-3xl font-bold mb-4">{business.name}</h1>
            
            {business.description && (
              <p className="text-muted-foreground mb-6">{business.description}</p>
            )}
            
            {business.cover_photo_path && (
              <div className="relative w-full h-40 md:h-60 mb-6 rounded-md overflow-hidden">
                <img 
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_covers/${business.cover_photo_path}`} 
                  alt={business.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="mt-6">
              <h2 className="text-2xl font-semibold mb-4">Book an Appointment</h2>
              <p className="mb-4 text-muted-foreground">
                Select a date and time to schedule your appointment.
              </p>
              
              {loadingEvents ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <>
                  <div className="mb-2 text-sm text-muted-foreground">
                    {allEvents.length} events showing on calendar
                  </div>
                  <Calendar 
                    defaultView="month"
                    publicMode={true} 
                    externalEvents={allEvents}
                    businessId={business.id}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </LanguageProvider>
  );
};
