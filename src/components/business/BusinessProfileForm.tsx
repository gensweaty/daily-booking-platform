
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState } from "react";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";

const formSchema = z.object({
  businessName: z.string().min(2, {
    message: "Business name must be at least 2 characters.",
  }),
  slug: z.string().min(2, {
    message: "URL slug must be at least 2 characters.",
  }),
  description: z.string().optional(),
  coverPhoto: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
});

export const BusinessProfileForm = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const { businessProfile, isLoading, createBusinessProfile, updateBusinessProfile, uploadCoverPhoto } = useBusinessProfile();

  useEffect(() => {
    setBaseUrl(`${window.location.protocol}//${window.location.host}/business`);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: "",
      slug: "",
      description: "",
      coverPhoto: "",
      phone: "",
      email: "",
      website: "",
      address: "",
    },
  });

  // Update form with business profile data when it's loaded
  useEffect(() => {
    if (businessProfile) {
      form.reset({
        businessName: businessProfile.business_name || "",
        slug: businessProfile.slug || "",
        description: businessProfile.description || "",
        coverPhoto: businessProfile.cover_photo_url || "",
        phone: businessProfile.contact_phone || "",
        email: businessProfile.contact_email || "",
        website: businessProfile.contact_website || "",
        address: businessProfile.contact_address || "",
      });
    }
  }, [businessProfile, form]);

  const handleCoverPhotoUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const { url } = await uploadCoverPhoto(file);
      if (url) {
        form.setValue("coverPhoto", url);
      }
    } catch (error) {
      console.error("Error uploading cover photo:", error);
      toast({
        title: t("common.error"),
        description: t("business.uploadError"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const profileData = {
        business_name: values.businessName,
        slug: values.slug,
        description: values.description,
        cover_photo_url: values.coverPhoto,
        contact_phone: values.phone,
        contact_email: values.email,
        contact_website: values.website,
        contact_address: values.address,
      };

      if (businessProfile) {
        await updateBusinessProfile(profileData);
      } else {
        await createBusinessProfile(profileData);
      }
    } catch (error: any) {
      console.error("Error updating business profile:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("common.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Business Name */}
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.businessName")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder="Your Business Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* URL Slug */}
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.urlSlug")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder="your-business-name" {...field} />
              </FormControl>
              <FormDescription>
                <LanguageText>{t("business.publicPageUrl")}</LanguageText>{" "}
                {baseUrl && <code>{baseUrl}/{field.value || 'your-business-name'}</code>}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.description")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Textarea placeholder="Describe your business" {...field} className="h-32" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cover Photo */}
        <FormField
          control={form.control}
          name="coverPhoto"
          render={({ field: { value, onChange, ...field } }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.coverPhoto")}</LanguageText>
              </FormLabel>
              <FormControl>
                <FileUploadField
                  imageUrl={value}
                  onUpload={(url) => onChange(url)}
                  onFileSelect={handleCoverPhotoUpload}
                  bucket="business_covers"
                  uploadText={t("business.uploadImageCover")}
                  chooseFileText={t("business.chooseFile")}
                  noFileText={t("business.noFileChosen")}
                  maxSizeMB={5}
                  acceptedFileTypes="image/*"
                  isUploading={isUploading}
                  disabled={isUploading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Phone */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.phone")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder="+1 (555) 123-4567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.email")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder="contact@yourbusiness.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Website */}
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.website")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder="https://yourbusiness.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Address */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.address")}</LanguageText>
              </FormLabel>
              <FormControl>
                <Input placeholder="123 Main St, City, Country" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full md:w-auto" disabled={isLoading || isUploading}>
          {isLoading ? (
            t("common.loading")
          ) : (
            <LanguageText>{t("business.updateProfile")}</LanguageText>
          )}
        </Button>
      </form>
    </Form>
  );
};
