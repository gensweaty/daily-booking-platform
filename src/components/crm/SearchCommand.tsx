
import * as React from "react"
import {
  Command,
  CommandInput,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Search } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText"

interface SearchCommandProps {
  onChange: (value: string) => void
}

export const SearchCommand = React.memo(({ onChange }: SearchCommandProps) => {
  const [searchValue, setSearchValue] = React.useState<string>("");
  const { language } = useLanguage();
  const isGeorgian = language === 'ka';

  // Handle search input changes
  const handleSearch = (search: string) => {
    setSearchValue(search);
    onChange(search);
  };

  return (
    <div className="w-full md:w-[200px] -mt-4">
      <Command className="rounded-lg border">
        <CommandInput
          placeholder={isGeorgian ? "ძიება..." : "Search..."}
          className={`h-9 ${isGeorgian ? "georgian-text-fix" : ""}`}
          value={searchValue}
          onValueChange={handleSearch}
        />
      </Command>
    </div>
  );
});

SearchCommand.displayName = 'SearchCommand';
