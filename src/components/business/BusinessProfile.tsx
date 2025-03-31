
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BusinessProfile as BusinessProfileType } from "@/types/database";

type BusinessProfileProps = {
  businessProfile: BusinessProfileType;
};

export const BusinessProfile = ({ businessProfile }: BusinessProfileProps) => {
  // Safely parse business hours and services from JSON strings if they exist
  const businessHours = businessProfile.business_hours 
    ? JSON.parse(businessProfile.business_hours as unknown as string) 
    : null;
  
  const services = businessProfile.services 
    ? JSON.parse(businessProfile.services as unknown as string) 
    : null;
  
  const socialMedia = businessProfile.social_media 
    ? JSON.parse(businessProfile.social_media as unknown as string) 
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Business Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={businessProfile.logo_url as string || ""} alt={businessProfile.name || "Business"} />
              <AvatarFallback>{businessProfile.name ? businessProfile.name[0].toUpperCase() : "B"}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{businessProfile.name}</h3>
              <p className="text-sm text-muted-foreground">{businessProfile.description}</p>
            </div>
          </div>

          <div className="grid gap-4 pt-4">
            <h4 className="font-medium">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{businessProfile.address || "No address provided"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Contact</p>
                <p className="text-sm text-muted-foreground">Email: {businessProfile.email || "No email provided"}</p>
                <p className="text-sm text-muted-foreground">Phone: {businessProfile.phone || "No phone provided"}</p>
                <p className="text-sm text-muted-foreground">Website: {businessProfile.website || "No website provided"}</p>
              </div>
            </div>
          </div>

          {businessHours && (
            <div className="grid gap-4 pt-4">
              <h4 className="font-medium">Business Hours</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day}>
                    <p className="text-sm font-medium">{day}</p>
                    <p className="text-sm text-muted-foreground">{hours as React.ReactNode || "Closed"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {services && services.length > 0 && (
            <div className="grid gap-4 pt-4">
              <h4 className="font-medium">Services</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service: any, index: number) => (
                  <div key={index} className="p-3 border rounded-md">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                    <p className="mt-2 font-medium">${service.price}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {socialMedia && (
            <div className="grid gap-4 pt-4">
              <h4 className="font-medium">Social Media</h4>
              <div className="flex space-x-4">
                {Object.entries(socialMedia).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline"
                  >
                    {platform}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
