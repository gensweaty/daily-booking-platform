
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { usePublicBusiness } from "@/hooks/useBusiness";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { Calendar } from "@/components/Calendar/Calendar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Mail, Phone, MapPin, Globe, Calendar as CalendarIcon } from "lucide-react";
import { BusinessPublicEventDialog } from "@/components/business/BusinessPublicEventDialog";
import { useToast } from "@/components/ui/use-toast";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const BusinessPageContent = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: business, isLoading, isError } = usePublicBusiness(slug || "");
  const { events } = useCalendarEvents();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // If the URL has a date parameter, use it to open the booking dialog
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    if (dateParam) {
      try {
        const date = new Date(dateParam);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
          setIsEventDialogOpen(true);
        }
      } catch (error) {
        console.error("Invalid date parameter:", error);
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (isError || !business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Business Not Found</h1>
        <p className="text-muted-foreground mb-8">The business you're looking for doesn't exist or has been removed.</p>
        <Link to="/">
          <Button>Return Home</Button>
        </Link>
      </div>
    );
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsEventDialogOpen(true);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png" 
                alt="SmartBookly Logo" 
                className="h-8 w-auto" 
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero section with cover photo */}
      {business.cover_photo_path ? (
        <div className="w-full h-64 relative">
          <img 
            src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_photos/${business.cover_photo_path}`} 
            alt={business.name} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 container mx-auto p-6">
            <h1 className="text-3xl font-bold text-white">{business.name}</h1>
          </div>
        </div>
      ) : (
        <div className="w-full bg-gradient-to-r from-primary/20 to-secondary/20 h-32 flex items-center">
          <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold">{business.name}</h1>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="container mx-auto p-4 md:p-6 lg:py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Sidebar with business info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">{t('common.about')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {business.description || "No description provided."}
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">{t('businessSettings.contactInfo')}</h2>
              <ul className="space-y-3">
                {business.contact_phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{business.contact_phone}</span>
                  </li>
                )}
                {business.contact_email && (
                  <li className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <a 
                      href={`mailto:${business.contact_email}`} 
                      className="hover:text-primary transition-colors"
                    >
                      {business.contact_email}
                    </a>
                  </li>
                )}
                {business.contact_address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-1" />
                    <span>{business.contact_address}</span>
                  </li>
                )}
                {business.contact_website && (
                  <li className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <a 
                      href={business.contact_website.startsWith('http') ? business.contact_website : `https://${business.contact_website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors"
                    >
                      {business.contact_website.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <Button 
                className="w-full flex items-center gap-2"
                onClick={() => {
                  setSelectedDate(new Date());
                  setIsEventDialogOpen(true);
                }}
              >
                <CalendarIcon className="h-4 w-4" />
                {t('events.requestEvent')}
              </Button>
            </div>
          </div>

          {/* Main content with booking calendar */}
          <div className="md:col-span-2">
            <Tabs defaultValue="calendar" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="calendar">{t('dashboard.bookingCalendar')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="calendar">
                <div className="border rounded-lg p-4">
                  <Calendar 
                    defaultView="month" 
                    onDateClick={handleDateClick}
                    publicMode={true}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">&copy; {new Date().getFullYear()} {business.name}. All rights reserved.</p>
          <p className="text-xs text-muted-foreground mt-2">Powered by <a href="/" className="text-primary hover:underline">SmartBookly</a></p>
        </div>
      </footer>

      {/* Booking dialog */}
      {isEventDialogOpen && selectedDate && (
        <BusinessPublicEventDialog
          open={isEventDialogOpen}
          onOpenChange={setIsEventDialogOpen}
          selectedDate={selectedDate}
          businessId={business.id}
        />
      )}
    </div>
  );
};

// Wrapper component that provides the LanguageProvider
const BusinessPage = () => {
  return (
    <LanguageProvider>
      <BusinessPageContent />
    </LanguageProvider>
  );
};

export default BusinessPage;
