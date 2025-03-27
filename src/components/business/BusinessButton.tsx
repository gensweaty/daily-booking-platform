
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Building } from "lucide-react";
import { BusinessForm } from "./BusinessForm";
import { useBusiness } from "@/hooks/useBusiness";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

export const BusinessButton = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { business, isLoading } = useBusiness();
  const { language } = useLanguage();

  if (isLoading) {
    return (
      <Button disabled variant="outline" size="sm">
        <Building className="mr-2 h-4 w-4" />
        {language === 'es' ? 'Cargando...' : 'Loading...'}
      </Button>
    );
  }

  if (business) {
    return (
      <Link to={`/business/${business.slug}`} target="_blank">
        <Button variant="outline" size="sm">
          <Building className="mr-2 h-4 w-4" />
          {language === 'es' ? 'Ver Página del Negocio' : 'View Business Page'}
        </Button>
      </Link>
    );
  }

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)} variant="outline" size="sm">
        <Building className="mr-2 h-4 w-4" />
        {language === 'es' ? 'Añadir Negocio' : 'Add Business'}
      </Button>
      <BusinessForm 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
      />
    </>
  );
};
