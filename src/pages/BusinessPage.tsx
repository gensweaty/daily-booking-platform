
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/Calendar/Calendar";
import { BusinessData } from "@/components/business/BusinessDialog";
import { supabase } from "@/lib/supabase";
import { Building, Phone, Mail, Globe, MapPin, ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const BusinessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBusiness = async () => {
      if (!slug) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("businesses")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          navigate("/");
          return;
        }
        
        setBusiness(data);
      } catch (error: any) {
        console.error("Error fetching business:", error);
        toast({
          title: t("business.error"),
          description: t("business.errorLoadingBusiness"),
          variant: "destructive",
        });
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusiness();
  }, [slug, navigate, toast, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!business) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="mr-4"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building className="h-5 w-5" />
              {business.name}
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6">
                {business.cover_photo_path && (
                  <div className="mb-6 rounded-md overflow-hidden">
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business-photos/${business.cover_photo_path}`}
                      alt={business.name}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <Badge className="mb-2">{t("business.businessInfo")}</Badge>
                    {business.description && (
                      <p className="text-gray-600 mb-4">{business.description}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    {business.contact_phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {t("business.contactPhone")}
                          </h3>
                          <p className="text-sm text-gray-600">{business.contact_phone}</p>
                        </div>
                      </div>
                    )}

                    {business.contact_email && (
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {t("business.contactEmail")}
                          </h3>
                          <a
                            href={`mailto:${business.contact_email}`}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {business.contact_email}
                          </a>
                        </div>
                      </div>
                    )}

                    {business.contact_website && (
                      <div className="flex items-start gap-3">
                        <Globe className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {t("business.contactWebsite")}
                          </h3>
                          <a
                            href={business.contact_website.startsWith('http') ? business.contact_website : `https://${business.contact_website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {business.contact_website}
                          </a>
                        </div>
                      </div>
                    )}

                    {business.contact_address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {t("business.contactAddress")}
                          </h3>
                          <p className="text-sm text-gray-600 whitespace-pre-line">
                            {business.contact_address}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardContent className="p-4 h-full">
                <h2 className="text-xl font-semibold mb-4">{t("business.bookingCalendar")}</h2>
                <div className="h-[700px]">
                  <Calendar isPublic={true} businessId={business.id} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
