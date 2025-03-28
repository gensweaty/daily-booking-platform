
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Business } from "@/lib/types";
import { BusinessForm } from "./BusinessForm";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Copy, ExternalLink, Pencil } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { EventRequestList } from "./EventRequestList";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface BusinessDetailsProps {
  business: Business;
  onUpdate: (business: Business) => void;
  onDelete: () => void;
}

export const BusinessDetails = ({ 
  business, 
  onUpdate,
  onDelete
}: BusinessDetailsProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Fetch event requests for this business
  const { data: eventRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['eventRequests', business.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_requests')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleCopyLink = () => {
    const url = `${window.location.origin}/business/${business.slug}`;
    navigator.clipboard.writeText(url);
    toast({
      title: t("notifications.urlCopied"),
      description: url,
    });
  };

  const handleVisitPage = () => {
    const url = `/business/${business.slug}`;
    window.open(url, '_blank');
  };

  if (isEditing) {
    return (
      <BusinessForm 
        initialData={business}
        onSubmit={(data) => {
          onUpdate(data);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="relative pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl font-bold">{business.name}</CardTitle>
              <CardDescription>{business.description}</CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {business.cover_photo_path && (
            <div className="mb-4">
              <img 
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/business_covers/${business.cover_photo_path}`}
                alt={business.name}
                className="w-full h-48 object-cover rounded-md"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {business.contact_phone && (
              <div>
                <span className="font-medium">Phone:</span> {business.contact_phone}
              </div>
            )}
            {business.contact_email && (
              <div>
                <span className="font-medium">Email:</span> {business.contact_email}
              </div>
            )}
            {business.contact_address && (
              <div>
                <span className="font-medium">Address:</span> {business.contact_address}
              </div>
            )}
            {business.contact_website && (
              <div>
                <span className="font-medium">Website:</span> <a href={business.contact_website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{business.contact_website}</a>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <Badge variant="outline" className="bg-primary/10">
              {t("business.publicPage")}
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex gap-1 items-center text-xs h-6"
              onClick={handleCopyLink}
            >
              <Copy className="h-3 w-3" />
              {t("business.copyLink")}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex gap-1 items-center text-xs h-6"
              onClick={handleVisitPage}
            >
              <ExternalLink className="h-3 w-3" />
              {t("business.visit")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("eventRequests.title")}</CardTitle>
          <CardDescription>
            Manage booking requests from your public business page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventRequestList 
            eventRequests={eventRequests} 
            isLoading={isLoadingRequests} 
          />
        </CardContent>
      </Card>

      <Button 
        variant="destructive" 
        className="w-full"
        onClick={onDelete}
      >
        {t("business.delete")}
      </Button>
    </div>
  );
};
