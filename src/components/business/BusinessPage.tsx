
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Store } from "lucide-react";
import { BusinessForm } from "./BusinessForm";
import { BusinessDetails } from "./BusinessDetails";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

export const BusinessPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const {
    business,
    isBusinessLoading,
    businessError,
    createBusiness,
    updateBusiness,
    deleteBusiness,
    uploadCoverPhoto
  } = useBusiness();
  
  if (!user) {
    navigate("/signin");
    return null;
  }
  
  if (businessError) {
    console.error("Business data error:", businessError);
  }
  
  const handleCreateBusiness = async (formData: any, coverPhoto?: File) => {
    try {
      const newBusiness = await createBusiness(formData);
      
      if (coverPhoto && newBusiness) {
        await uploadCoverPhoto({ file: coverPhoto, businessId: newBusiness.id });
      }
    } catch (error) {
      console.error("Error creating business:", error);
      throw error;
    }
  };
  
  const handleUpdateBusiness = async (formData: any, coverPhoto?: File) => {
    if (!business) return;
    
    try {
      await updateBusiness({ id: business.id, updates: formData });
      
      if (coverPhoto) {
        await uploadCoverPhoto({ file: coverPhoto, businessId: business.id });
      }
    } catch (error) {
      console.error("Error updating business:", error);
      throw error;
    }
  };
  
  const handleDeleteBusiness = async () => {
    if (!business) return;
    
    try {
      await deleteBusiness(business.id);
    } catch (error) {
      console.error("Error deleting business:", error);
      throw error;
    }
  };
  
  if (isBusinessLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">My Business</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full rounded-md" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!business) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">My Business</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Store className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No business profile yet</h3>
            <p className="mb-6 text-sm text-muted-foreground max-w-md">
              Create a business profile to get your own booking page and start
              receiving bookings from customers.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Business
            </Button>
          </div>
          
          <BusinessForm
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            onSubmit={handleCreateBusiness}
          />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <BusinessDetails
      business={business}
      onEdit={handleUpdateBusiness}
      onDelete={handleDeleteBusiness}
    />
  );
};
