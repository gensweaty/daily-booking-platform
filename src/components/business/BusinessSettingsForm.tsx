
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface BusinessProfile {
  id?: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  business_hours: string;
  slug: string;
  user_id: string;
}

export const BusinessSettingsForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    business_hours: '',
    slug: '',
    user_id: ''
  });

  useEffect(() => {
    if (user) {
      fetchBusinessProfile();
    }
  }, [user]);

  const fetchBusinessProfile = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setBusinessProfile(data);
      } else {
        // Initialize with user ID if no profile exists
        setBusinessProfile({
          ...businessProfile,
          user_id: user?.id || '',
          email: user?.email || '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching business profile:', error);
      toast({
        title: "Error",
        description: "Failed to load business profile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBusinessProfile(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Auto-generate slug from business name if slug is empty
    if (name === 'name' && (!businessProfile.slug || businessProfile.slug === '')) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setBusinessProfile(prev => ({
        ...prev,
        slug
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      
      // Validate required fields
      if (!businessProfile.name || !businessProfile.slug) {
        toast({
          title: "Validation Error",
          description: "Business name and slug are required",
          variant: "destructive"
        });
        return;
      }
      
      // Check if slug is unique (if it's a new profile or slug has changed)
      if (!businessProfile.id || businessProfile.slug !== businessProfile.slug) {
        const { data: existingSlug, error: slugError } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('slug', businessProfile.slug)
          .neq('user_id', user?.id || '')
          .maybeSingle();
          
        if (existingSlug) {
          toast({
            title: "Validation Error",
            description: "This business URL is already taken. Please choose another.",
            variant: "destructive"
          });
          return;
        }
      }
      
      // Create or update business profile
      const { data, error } = await supabase
        .from('business_profiles')
        .upsert({
          ...businessProfile,
          user_id: user?.id
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setBusinessProfile(data);
      
      toast({
        title: "Success",
        description: "Business profile saved successfully"
      });
    } catch (error: any) {
      console.error('Error saving business profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save business profile",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Profile</CardTitle>
        <CardDescription>
          Manage your business information and public booking page
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name *</Label>
              <Input
                id="name"
                name="name"
                value={businessProfile.name}
                onChange={handleInputChange}
                placeholder="Your Business Name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slug">Public URL *</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">yourdomain.com/business/</span>
                <Input
                  id="slug"
                  name="slug"
                  value={businessProfile.slug}
                  onChange={handleInputChange}
                  placeholder="your-business"
                  className="flex-1"
                  required
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={businessProfile.description}
              onChange={handleInputChange}
              placeholder="Describe your business..."
              rows={4}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={businessProfile.address}
                onChange={handleInputChange}
                placeholder="Business Address"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                value={businessProfile.phone}
                onChange={handleInputChange}
                placeholder="Phone Number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                value={businessProfile.email}
                onChange={handleInputChange}
                placeholder="contact@yourbusiness.com"
                type="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                value={businessProfile.website}
                onChange={handleInputChange}
                placeholder="https://yourbusiness.com"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="business_hours">Business Hours</Label>
            <Textarea
              id="business_hours"
              name="business_hours"
              value={businessProfile.business_hours}
              onChange={handleInputChange}
              placeholder="Mon-Fri: 9am-5pm, Sat: 10am-3pm, Sun: Closed"
              rows={2}
            />
          </div>
          
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
