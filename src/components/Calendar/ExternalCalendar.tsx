
import { Calendar } from "./Calendar";
import { Card, CardContent } from "@/components/ui/card";

export const ExternalCalendar = () => {
  return (
    <Card className="min-h-[calc(100vh-12rem)] overflow-hidden">
      <CardContent className="p-0">
        <div className="px-6 pt-6">
          <Calendar defaultView="month" isExternalCalendar={true} />
        </div>
      </CardContent>
    </Card>
  );
};
