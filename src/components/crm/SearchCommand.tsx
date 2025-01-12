import * as React from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Search } from "lucide-react"

interface SearchCommandProps {
  data: any[]
  onSelect: (item: any) => void
  setFilteredData: (data: any[]) => void
}

export function SearchCommand({ data, onSelect, setFilteredData }: SearchCommandProps) {
  const handleSearch = React.useCallback((search: string) => {
    if (!search) {
      setFilteredData(data)
      return
    }

    const searchLower = search.toLowerCase()
    const filtered = data.filter((item) => {
      return (
        // Search by title (full name)
        item.title?.toLowerCase().includes(searchLower) ||
        // Search by phone number
        item.user_number?.toLowerCase().includes(searchLower) ||
        // Search by social link/email
        item.social_network_link?.toLowerCase().includes(searchLower) ||
        // Search by comment/notes
        item.event_notes?.toLowerCase().includes(searchLower)
      )
    })
    setFilteredData(filtered)
  }, [data, setFilteredData])

  return (
    <Command className="rounded-lg border shadow-md">
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <CommandInput
          placeholder="Search customers..."
          className="h-11 border-0 focus:ring-0"
          onValueChange={handleSearch}
        />
      </div>
      <CommandList className="max-h-[300px]">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          {data.map((item) => (
            <CommandItem
              key={item.id}
              value={item.title}
              onSelect={() => onSelect(item)}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span>{item.title}</span>
                {item.user_number && (
                  <span className="text-sm text-muted-foreground">
                    {item.user_number}
                  </span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}