
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessProfile as BusinessProfileType } from "@/types/database";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface BusinessProfileProps {
  businessProfile: BusinessProfileType;
}

export const BusinessProfile = ({ businessProfile }: BusinessProfileProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <Avatar className="h-24 w-24">
                <AvatarImage src={businessProfile.logo_url || ""} alt={businessProfile.slug} />
                <AvatarFallback className="text-2xl">
                  {businessProfile.slug?.charAt(0).toUpperCase() || "B"}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-4 flex-grow">
              <div>
                <h3 className="font-semibold">Business Name</h3>
                <p>{businessProfile.slug}</p>
              </div>
              <div>
                <h3 className="font-semibold">Description</h3>
                <p className="text-muted-foreground">{businessProfile.description || "No description provided."}</p>
              </div>
              <div>
                <h3 className="font-semibold">Address</h3>
                <p className="text-muted-foreground">{businessProfile.address || "No address provided."}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Contact Information</h3>
                <p className="text-muted-foreground">Email: {businessProfile.email || "No email provided."}</p>
                <p className="text-muted-foreground">Phone: {businessProfile.phone || "No phone provided."}</p>
                <p className="text-muted-foreground">Website: {businessProfile.website || "No website provided."}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {businessProfile.business_hours && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Business Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(JSON.parse(businessProfile.business_hours)).map(([day, hours]) => (
                <div key={day} className="flex justify-between">
                  <span className="font-medium">{day}</span>
                  <span className="text-muted-foreground">{hours}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {businessProfile.services?.split(',').map((service) => (
              <div key={service} className="bg-secondary px-3 py-1 rounded-full text-sm">
                {service.trim()}
              </div>
            ))}
            {!businessProfile.services && <p className="text-muted-foreground">No services provided.</p>}
          </div>
        </CardContent>
      </Card>

      {businessProfile.social_media && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Social Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(JSON.parse(businessProfile.social_media)).map(([platform, url]) => (
                <a 
                  key={platform} 
                  href={url as string} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span className="capitalize">{platform}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Public Page</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Public URL</h3>
              <a
                href={`/business/${businessProfile.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {window.location.origin}/business/{businessProfile.slug}
              </a>
            </div>
            <div>
              <h3 className="font-semibold">Share This Link</h3>
              <p className="text-muted-foreground">Share this link with your customers to allow them to book appointments directly.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
