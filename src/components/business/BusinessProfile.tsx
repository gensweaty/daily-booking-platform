
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Business } from "@/lib/types";
import { createBusiness, updateBusiness } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { FileUploadField } from "@/components/shared/FileUploadField";

const businessSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  slug: z.string().min(3, "Slug must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens allowed")
    .optional(),
  cover_photo_path: z.string().optional(),
});

type BusinessFormValues = z.infer<typeof businessSchema>;

interface BusinessProfileProps {
  existingBusiness?: Business;
}

export const BusinessProfile = ({ existingBusiness }: BusinessProfileProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(
    existingBusiness?.cover_photo_path 
      ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_covers/${existingBusiness.cover_photo_path}`
      : null
  );
  
  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: existingBusiness?.name || "",
      description: existingBusiness?.description || "",
      slug: existingBusiness?.slug || "",
      cover_photo_path: existingBusiness?.cover_photo_path || "",
    },
  });

  const onSubmit = async (data: BusinessFormValues) => {
    try {
      setIsSubmitting(true);
      let result: Business;
      
      if (existingBusiness) {
        result = await updateBusiness(existingBusiness.id, data);
        toast({
          title: "Business updated!",
          description: "Your business profile has been updated successfully.",
        });
      } else {
        result = await createBusiness(data);
        toast({
          title: "Business created!",
          description: "Your business profile has been created successfully.",
        });
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['business'] });
      
    } catch (error) {
      console.error("Error submitting business form:", error);
      toast({
        title: "Error",
        description: "Failed to save business profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (path: string) => {
    form.setValue("cover_photo_path", path);
    setCoverImage(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_covers/${path}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existingBusiness ? "Edit Business Profile" : "Create Business Profile"}</CardTitle>
        <CardDescription>
          Set up your business profile to allow clients to book appointments with you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Business Name *</Label>
            <Input
              id="name"
              placeholder="Your Business Name"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slug">Business URL Slug *</Label>
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground whitespace-nowrap">
                {window.location.origin}/business/
              </span>
              <Input
                id="slug"
                placeholder="your-business"
                {...form.register("slug")}
              />
            </div>
            {form.formState.errors.slug && (
              <p className="text-sm text-destructive">{form.formState.errors.slug.message}</p>
            )}
            <p className="text-sm text-muted-foreground">
              This will be used in the URL for your public booking page.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Business Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Tell clients about your business..."
              className="min-h-[120px]"
              {...form.register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>Cover Image (Optional)</Label>
            <FileUploadField
              onFileUploaded={handleFileUpload}
              currentImage={coverImage}
              bucketName="business_covers"
              className="w-full aspect-[3/1] border rounded-md"
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : existingBusiness ? "Update Business" : "Create Business"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
