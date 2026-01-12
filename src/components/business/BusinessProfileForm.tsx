
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useEffect, useState, useCallback } from "react";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { WorkingHoursSelector } from "./WorkingHoursSelector";
import { WorkingHoursConfig, DEFAULT_WORKING_HOURS } from "@/types/workingHours";

// Custom function to validate website input
const websiteValidator = (value: string) => {
  if (!value) return true; // Empty values are handled by .optional()
  
  // If the input already has a protocol, use the URL validator
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  } 
  
  // For domain-only inputs like "smartbookly.com"
  // Simple regex to check if it looks like a domain
  // This allows formats like: example.com, sub.example.com
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(value);
};

const formSchema = z.object({
  businessName: z.string().min(2, {
    message: "Business name must be at least 2 characters.",
  }),
  slug: z.string().min(2, {
    message: "URL slug must be at least 2 characters.",
  }),
  description: z.string().optional(),
  coverPhoto: z.string().optional(),
  avatarPhoto: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string()
    .refine(websiteValidator, {
      message: "Please enter a valid website domain (e.g., example.com) or full URL",
    })
    .optional(),
  address: z.string().optional(),
});

export const BusinessProfileForm = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>(DEFAULT_WORKING_HOURS);
  const { businessProfile, isLoading, createBusinessProfile, updateBusinessProfile, uploadCoverPhoto, uploadAvatarPhoto } = useBusinessProfile();
  const isGeorgian = language === 'ka';

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
      avatarPhoto: "",
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
        avatarPhoto: businessProfile.avatar_url || "",
        phone: businessProfile.contact_phone || "",
        email: businessProfile.contact_email || "",
        website: businessProfile.contact_website || "",
        address: businessProfile.contact_address || "",
      });
      // Load working hours if available
      if (businessProfile.working_hours) {
        setWorkingHours(businessProfile.working_hours);
      }
    }
  }, [businessProfile, form]);

  // Memoized handler for working hours changes
  const handleWorkingHoursChange = useCallback((newWorkingHours: WorkingHoursConfig) => {
    setWorkingHours(newWorkingHours);
  }, []);

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

  const handleAvatarPhotoUpload = async (file: File) => {
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const { url } = await uploadAvatarPhoto(file);
      if (url) {
        form.setValue("avatarPhoto", url);
      }
    } catch (error) {
      console.error("Error uploading avatar photo:", error);
      toast({
        title: t("common.error"),
        description: t("business.uploadError"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Format the website value to ensure it has a protocol if needed
      let websiteValue = values.website;
      if (websiteValue && !websiteValue.startsWith('http://') && !websiteValue.startsWith('https://')) {
        websiteValue = `https://${websiteValue}`;
      }
      
      const profileData = {
        business_name: values.businessName,
        slug: values.slug,
        description: values.description,
        cover_photo_url: values.coverPhoto,
        avatar_url: values.avatarPhoto,
        contact_phone: values.phone,
        contact_email: values.email,
        contact_website: websiteValue,
        contact_address: values.address,
        working_hours: workingHours,
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

  // Helper function to render label with proper Georgian text handling
  const renderFormLabel = (translationKey: string, georgianText?: string) => {
    if (isGeorgian && georgianText) {
      return <GeorgianAuthText>{georgianText}</GeorgianAuthText>;
    }
    return <LanguageText>{t(translationKey)}</LanguageText>;
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
                {renderFormLabel("business.businessName", "ბიზნესის სახელი")}
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

        {/* Avatar Photo (Logo) */}
        <FormField
          control={form.control}
          name="avatarPhoto"
          render={({ field: { value, onChange, ...field } }) => (
            <FormItem>
              <FormLabel>
                <LanguageText>{t("business.avatarPhoto")}</LanguageText>
              </FormLabel>
              <FormDescription>
                <LanguageText>{t("business.avatarPhotoDescription")}</LanguageText>
              </FormDescription>
              <FormControl>
                <FileUploadField
                  imageUrl={value}
                  onUpload={(url) => onChange(url)}
                  onFileSelect={handleAvatarPhotoUpload}
                  bucket="business_covers"
                  uploadText={t("business.uploadAvatarPhoto")}
                  chooseFileText={t("business.chooseFile")}
                  noFileText={t("business.noFileChosen")}
                  maxSizeMB={2}
                  acceptedFileTypes="image/*"
                  isUploading={isUploadingAvatar}
                  disabled={isUploadingAvatar}
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
                {renderFormLabel("business.email", "ელექტრონული ფოსტა")}
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
                {renderFormLabel("business.website", "ვებ გვერდი")}
              </FormLabel>
              <FormControl>
                <Input placeholder="smartbookly.com" {...field} />
              </FormControl>
              <FormDescription>
                <LanguageText>Enter domain name or full URL with http(s)://</LanguageText>
              </FormDescription>
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

        {/* Working Hours */}
        <WorkingHoursSelector 
          value={workingHours}
          onChange={handleWorkingHoursChange}
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
