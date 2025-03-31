
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { BusinessProfile as BusinessProfileType } from "@/types/database";

type BusinessProfileProps = {
  businessProfile: BusinessProfileType;
};

export const BusinessProfile = ({ businessProfile }: BusinessProfileProps) => {
  // Handle optional fields
  const businessHours = businessProfile?.business_hours || [];
  const hasBusinessHours = Array.isArray(businessHours) && businessHours.length > 0;
  
  const services = businessProfile?.services || [];
  const hasServices = Array.isArray(services) && services.length > 0;
  
  const socialMedia = businessProfile?.social_media || [];
  const hasSocialMedia = Array.isArray(socialMedia) && socialMedia.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                {businessProfile?.logo_url ? (
                  <img src={businessProfile.logo_url} alt={businessProfile?.name || "Business logo"} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold">{businessProfile?.name ? businessProfile.name.charAt(0) : "B"}</span>
                )}
              </div>
            </div>
            <div className="space-y-4 flex-1">
              <h3 className="text-2xl font-bold">{businessProfile?.name || "Business Name"}</h3>
              <div>
                <p className="text-muted-foreground">{businessProfile?.description || "No description provided"}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Contact Information</h4>
                <div className="space-y-1">
                  <p className="text-sm"><span className="font-medium">Address:</span> {businessProfile?.address || "No address provided"}</p>
                  <div className="flex flex-wrap gap-2">
                    {businessProfile?.email && (
                      <p className="text-sm"><span className="font-medium">Email:</span> {businessProfile.email}</p>
                    )}
                    {businessProfile?.phone && (
                      <p className="text-sm"><span className="font-medium">Phone:</span> {businessProfile.phone}</p>
                    )}
                    {businessProfile?.website && (
                      <p className="text-sm"><span className="font-medium">Website:</span> {businessProfile.website}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hasServices && (
            <>
              <Separator className="my-6" />
              <div>
                <h4 className="font-semibold mb-3">Services</h4>
                <div className="flex flex-wrap gap-2">
                  {services.map((service, index) => (
                    <Badge key={index} variant="secondary">{service}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {hasBusinessHours && (
            <>
              <Separator className="my-6" />
              <div>
                <h4 className="font-semibold mb-3">Business Hours</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {businessHours.map((hour, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{hour.day}:</span> {hour.hours}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {hasSocialMedia && (
            <>
              <Separator className="my-6" />
              <div>
                <h4 className="font-semibold mb-3">Social Media</h4>
                <div className="flex flex-wrap gap-3">
                  {socialMedia.map((platform, index) => (
                    <a 
                      key={index}
                      href={platform.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {platform.name}
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
