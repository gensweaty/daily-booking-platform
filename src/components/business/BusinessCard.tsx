import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Business } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExternalLink, Edit, Trash } from 'lucide-react';

interface BusinessCardProps {
  business: Business;
  onEdit: (business: Business) => void;
  onDelete: (id: string) => void;
}

export const BusinessCard = ({ business, onEdit, onDelete }: BusinessCardProps) => {
  const [coverImageUrl, setCoverImageUrl] = useState<string>('/placeholder.svg');
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchCoverImage = async () => {
      if (business.cover_photo) {
        const coverImageUrl = business.cover_photo 
          ? await supabase.storage.from('business-images').getPublicUrl(business.cover_photo).data.publicUrl 
          : '/placeholder.svg';
        setCoverImageUrl(coverImageUrl);
      }
    };

    fetchCoverImage();
  }, [business.cover_photo]);

  return (
    <Card className="overflow-hidden">
      <div className="h-48 overflow-hidden">
        <img 
          src={coverImageUrl} 
          alt={business.name} 
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader>
        <CardTitle>{business.name}</CardTitle>
        <CardDescription className="line-clamp-2">{business.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {business.contact_phone && (
            <p className="text-sm">📞 {business.contact_phone}</p>
          )}
          {business.contact_email && (
            <p className="text-sm">✉️ {business.contact_email}</p>
          )}
          {business.contact_address && (
            <p className="text-sm">📍 {business.contact_address}</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate(`/business/${business.slug}`)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          {t('business.publicPage')}
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onEdit(business)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onDelete(business.id)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
