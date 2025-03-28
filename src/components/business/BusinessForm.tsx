
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Business } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { Image, Upload } from "lucide-react";

const businessFormSchema = z.object({
  name: z.string().min(2, "Business name must be at least 2 characters."),
  description: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_address: z.string().optional(),
  contact_email: z.string().email("Invalid email address.").optional().or(z.literal("")),
  contact_website: z.string().url("Invalid URL format.").optional().or(z.literal("")),
});

type BusinessFormValues = z.infer<typeof businessFormSchema>;

interface BusinessFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Business;
  onSubmit: (data: BusinessFormValues, coverPhoto?: File) => Promise<void>;
}

export const BusinessForm = ({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: BusinessFormProps) => {
  const { t } = useLanguage();
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      contact_phone: initialData?.contact_phone || "",
      contact_address: initialData?.contact_address || "",
      contact_email: initialData?.contact_email || "",
      contact_website: initialData?.contact_website || "",
    },
  });

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverPhoto(e.target.files[0]);
    }
  };

  const handleSubmit = async (values: BusinessFormValues) => {
    try {
      setIsSubmitting(true);
      await onSubmit(values, coverPhoto || undefined);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting business form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Business" : "Add Business"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update your business information."
              : "Create a new business profile."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter business name" />
                  </FormControl>
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
                      {...field}
                      placeholder="Enter business description"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter contact phone" />
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
                  <FormLabel>Contact Address</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter contact address"
                      rows={2}
                    />
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
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Enter contact email"
                    />
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
                    <Input
                      {...field}
                      placeholder="Enter website URL (e.g., https://example.com)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <FormLabel>Cover Photo</FormLabel>
              <div className="flex items-center gap-4">
                {initialData?.cover_photo_path && !coverPhoto && (
                  <div className="relative w-16 h-16 rounded overflow-hidden bg-gray-100">
                    <Image className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                )}
                {coverPhoto && (
                  <div className="relative w-16 h-16 rounded overflow-hidden">
                    <img
                      src={URL.createObjectURL(coverPhoto)}
                      alt="Cover preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <label
                    htmlFor="cover-photo"
                    className="flex items-center justify-center w-full h-10 px-3 border border-input bg-background rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    <span>
                      {coverPhoto
                        ? coverPhoto.name
                        : initialData?.cover_photo_path
                        ? "Change photo"
                        : "Upload photo"}
                    </span>
                    <input
                      id="cover-photo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverPhotoChange}
                    />
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : initialData
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
