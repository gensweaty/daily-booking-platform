
import React from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export interface SearchCommandProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchCommand = ({ value, onChange, placeholder = 'Search...' }: SearchCommandProps) => {
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  return (
    <div className="relative flex-1">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pl-8 ${isGeorgian ? 'font-georgian' : ''}`}
      />
    </div>
  );
};
