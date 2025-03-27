
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useBusiness } from "@/hooks/useBusiness";
import { Building, Phone, Mail, Globe, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/Calendar/Calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export const BusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { getBusinessBySlug } = useBusiness();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    const fetchBusiness = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        const data = await getBusinessBySlug(slug);
        if (data) {
          setBusiness(data);
        } else {
          toast({
            title: t("business.businessNotFound"),
            description: t("business.businessNotFoundDesc"),
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching business:", error);
        toast({
          title: t("common.error"),
          description: t("business.errorLoadingBusiness"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [slug, getBusinessBySlug, t, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <h1 className="text-2xl font-bold mb-4">{t("business.businessNotFound")}</h1>
        <p className="text-muted-foreground mb-6">{t("business.businessNotFoundDesc")}</p>
        <Button onClick={() => window.location.href = "/"}>
          {t("common.backToHome")}
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-8">
        <CardHeader className="relative">
          {business.cover_photo_path && (
            <div className="absolute inset-0 overflow-hidden rounded-t-lg">
              <img 
                src={business.cover_photo_path} 
                alt={business.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30"></div>
            </div>
          )}
          
          <CardTitle className={`text-3xl font-bold relative z-10 ${business.cover_photo_path ? 'text-white' : ''}`}>
            {business.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {business.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">{t("business.aboutUs")}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{business.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">{t("business.contactInfo")}</h2>
              <ul className="space-y-3">
                {business.contact_phone && (
                  <li className="flex items-center">
                    <Phone className="mr-2 h-4 w-4" />
                    <span>{business.contact_phone}</span>
                  </li>
                )}
                {business.contact_email && (
                  <li className="flex items-center">
                    <Mail className="mr-2 h-4 w-4" />
                    <a href={`mailto:${business.contact_email}`} className="text-primary hover:underline">
                      {business.contact_email}
                    </a>
                  </li>
                )}
                {business.contact_website && (
                  <li className="flex items-center">
                    <Globe className="mr-2 h-4 w-4" />
                    <a 
                      href={business.contact_website.startsWith('http') ? business.contact_website : `https://${business.contact_website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {business.contact_website}
                    </a>
                  </li>
                )}
                {business.contact_address && (
                  <li className="flex items-start">
                    <MapPin className="mr-2 h-4 w-4 mt-1" />
                    <span className="whitespace-pre-wrap">{business.contact_address}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>{t("business.book")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="calendar">
            <TabsList className="mb-4">
              <TabsTrigger value="calendar">{t("business.calendar")}</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar">
              <Calendar 
                defaultView="month" 
                isPublic={true} 
                businessId={business.id}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
