
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoaderCircle, Image } from "lucide-react";
import { BusinessProfile } from "@/types/database";
import { FileUploadField } from "@/components/shared/FileUploadField";

// Define the schema making slug required
const businessProfileSchema = z.object({
  business_name: z.string().min(2, { message: "Business name must be at least 2 characters" }),
  slug: z.string().min(2, { message: "Slug must be at least 2 characters" })
    .regex(/^[a-z0-9-]+$/, { message: "Slug can only contain lowercase letters, numbers, and hyphens" }),
  description: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  contact_address: z.string().optional(),
  contact_website: z.string().url({ message: "Invalid URL" }).optional().or(z.literal("")),
  cover_photo_url: z.string().optional(),
});

type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>;

export const BusinessProfileForm = () => {
  const { businessProfile, isLoading, createBusinessProfile, updateBusinessProfile, generateSlug, uploadCoverPhoto } = useBusinessProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileError, setFileError] = useState("");
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);

  const form = useForm<BusinessProfileFormValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      business_name: "",
      slug: "",
      description: "",
      contact_phone: "",
      contact_email: "",
      contact_address: "",
      contact_website: "",
      cover_photo_url: "",
    },
  });

  useEffect(() => {
    if (businessProfile) {
      form.reset({
        business_name: businessProfile.business_name,
        slug: businessProfile.slug,
        description: businessProfile.description || "",
        contact_phone: businessProfile.contact_phone || "",
        contact_email: businessProfile.contact_email || "",
        contact_address: businessProfile.contact_address || "",
        contact_website: businessProfile.contact_website || "",
        cover_photo_url: businessProfile.cover_photo_url || "",
      });
    }
  }, [businessProfile, form]);

  const onSubmit = async (data: BusinessProfileFormValues) => {
    setIsSubmitting(true);
    try {
      // First upload the cover photo if provided
      let coverPhotoUrl = data.cover_photo_url;
      
      if (coverPhotoFile) {
        const uploadResult = await uploadCoverPhoto(coverPhotoFile);
        if (uploadResult.url) {
          coverPhotoUrl = uploadResult.url;
        }
      }
      
      if (businessProfile) {
        // Update existing profile
        updateBusinessProfile({
          ...data,
          cover_photo_url: coverPhotoUrl,
        });
      } else {
        // Create new profile
        createBusinessProfile({
          ...data,
          business_name: data.business_name,
          slug: data.slug,
          cover_photo_url: coverPhotoUrl,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBusinessNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const businessName = e.target.value;
    form.setValue("business_name", businessName);
    
    // Only auto-generate slug if it's a new profile or if the slug field hasn't been manually edited
    if (!businessProfile || form.getValues("slug") === businessProfile.slug) {
      const slug = generateSlug(businessName);
      form.setValue("slug", slug);
    }
  };

  const handleFileChange = (file: File | null) => {
    setCoverPhotoFile(file);
    
    if (file) {
      // Show a temp object URL in the form for preview
      const tempUrl = URL.createObjectURL(file);
      form.setValue("cover_photo_url", tempUrl);
      
      // Clean up the object URL when component unmounts
      return () => URL.revokeObjectURL(tempUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{businessProfile ? "Edit Business Profile" : "Create Business Profile"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your Business Name"
                      {...field}
                      onChange={handleBusinessNameChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Slug *</FormLabel>
                  <FormControl>
                    <Input placeholder="your-business-name" {...field} />
                  </FormControl>
                  <FormDescription>
                    This will be used for your public page: smartbookly.com/business/{form.watch("slug")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell potential customers about your business"
                      className="resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cover Photo Upload */}
            <FormField
              control={form.control}
              name="cover_photo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Photo</FormLabel>
                  <div className="space-y-4">
                    {field.value && (
                      <div className="relative w-full h-40 rounded-md overflow-hidden border border-gray-200">
                        <img 
                          src={field.value} 
                          alt="Business Cover" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Handle image load errors
                            e.currentTarget.src = 'https://placehold.co/600x200/e2e8f0/64748b?text=Business+Cover';
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <FileUploadField
                        onChange={handleFileChange}
                        fileError={fileError}
                        setFileError={setFileError}
                        acceptedFileTypes="image/*"
                        hideLabel={true}
                      />
                      <FormDescription>
                        Upload an image for your business cover (JPEG, PNG, WebP)
                      </FormDescription>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="contact@yourbusiness.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder="https://yourbusiness.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St, City, Country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isSubmitting || !!fileError}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {businessProfile ? "Update Profile" : "Create Profile"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
