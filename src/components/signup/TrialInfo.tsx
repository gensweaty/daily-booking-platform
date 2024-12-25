import { Card, CardContent } from "@/components/ui/card";
import { TrialInfoProps } from "./types";

export const TrialInfo = ({ daysLeft }: TrialInfoProps) => {
  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Free Trial Period</h3>
          <p className="text-muted-foreground">
            {daysLeft > 0 
              ? `${daysLeft} days remaining in your free trial`
              : "Your trial period has ended"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};