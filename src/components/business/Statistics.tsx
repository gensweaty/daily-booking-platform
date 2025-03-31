
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessProfile as BusinessProfileType } from "@/types/database";

type StatisticsProps = {
  businessProfile: BusinessProfileType;
};

export const Statistics = ({ businessProfile }: StatisticsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Statistics for {businessProfile?.business_name || "Your Business"}
        </p>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Total Bookings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
