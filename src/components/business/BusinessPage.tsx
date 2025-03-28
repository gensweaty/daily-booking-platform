
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
import { Business } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

export const BusinessPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
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
      console.log("Creating business with data:", formData);
      const newBusiness = await createBusiness(formData);
      
      if (coverPhoto && newBusiness) {
        console.log("Uploading cover photo for business:", newBusiness.id);
        
        // Check if business_covers bucket exists
        const { data: buckets, error: bucketsError } = await supabase
          .storage
          .listBuckets();
        
        const bucketExists = buckets?.find(b => b.name === 'business_covers');
        
        if (!bucketExists) {
          console.log("Creating business_covers bucket");
          const { error } = await supabase.storage.createBucket('business_covers', {
            public: true
          });
          
          if (error) {
            console.error("Error creating business_covers bucket:", error);
            toast({
              title: "Error",
              description: "Could not create storage for business covers. Please try again.",
              variant: "destructive",
            });
          }
        }
        
        await uploadCoverPhoto({ file: coverPhoto, businessId: newBusiness.id });
      }
      
      toast({
        title: "Success",
        description: "Business created successfully!",
      });
      
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating business:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create business. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleUpdateBusiness = async (formData: Business) => {
    if (!business) return;
    
    try {
      await updateBusiness({ id: business.id, updates: formData });
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
      onUpdate={handleUpdateBusiness}
      onDelete={handleDeleteBusiness}
    />
  );
};
