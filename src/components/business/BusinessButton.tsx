
import { Button } from "@/components/ui/button";
import { PlusCircle, Building } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface BusinessButtonProps {
  onAddClick: () => void;
  hasExistingBusiness: boolean;
}

export const BusinessButton = ({ onAddClick, hasExistingBusiness }: BusinessButtonProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between w-full">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Building className="h-6 w-6" />
        {t("business.myBusiness")}
      </h1>
      
      {!hasExistingBusiness && (
        <Button onClick={onAddClick} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          {t("business.addBusiness")}
        </Button>
      )}
    </div>
  );
};
