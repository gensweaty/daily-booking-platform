import * as React from "react"
import {
  Command,
  CommandInput,
} from "@/components/ui/command"

interface SearchCommandProps {
  data: any[];
  setFilteredData: (data: string) => void;
}

export function SearchCommand({ data, setFilteredData }: SearchCommandProps) {
  const handleSearch = React.useCallback((search: string) => {
    setFilteredData(search);
  }, [setFilteredData]);

  return (
    <Command className="w-full md:w-[200px] rounded-lg border -mt-4">
      <div className="flex items-center px-2">
        <CommandInput
          placeholder="Search..."
          className="h-9 border-0 focus:ring-0 px-0"
          onValueChange={handleSearch}
        />
      </div>
    </Command>
  );
}