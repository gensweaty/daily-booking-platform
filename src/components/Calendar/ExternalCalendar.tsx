
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageProvider } from "@/contexts/LanguageContext";

export const ExternalCalendar = ({ businessId }: { businessId: string }) => {
  if (!businessId) {
    console.error("No businessId provided to ExternalCalendar");
  }
  
  return (
    <LanguageProvider>
      <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
        <CardContent className="p-0">
          <div className="px-6 pt-6">
            <Calendar 
              defaultView="month" 
              isExternalCalendar={true} 
              businessId={businessId} 
            />
          </div>
        </CardContent>
      </Card>
    </LanguageProvider>
  );
};
