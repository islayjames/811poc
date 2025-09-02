"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent } from "@/components/ui/card"
import type { TicketFilters, TicketStatus, TicketListItem } from "@/lib/types"
import { getStatusLabel } from "@/lib/format"
import { FilterIcon, XIcon, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = [
  { label: "Draft", value: "Draft" as TicketStatus },
  { label: "Needs Confirm", value: "ValidPendingConfirm" as TicketStatus },
  { label: "Ready", value: "Ready" as TicketStatus },
  { label: "Submitted", value: "Submitted" as TicketStatus },
  { label: "Positive Responses In", value: "ResponsesIn" as TicketStatus },
  { label: "Ready to Dig", value: "ReadyToDig" as TicketStatus },
  { label: "Expiring Soon", value: "Expiring" as TicketStatus },
  { label: "Expired", value: "Expired" as TicketStatus },
  { label: "Cancelled", value: "Cancelled" as TicketStatus },
]

interface TicketsFiltersProps {
  filters: TicketFilters
  onFiltersChange: (filters: Partial<TicketFilters>) => void
  tickets: TicketListItem[]
  onClearAll: () => void
}

export function TicketsFilters({ filters, onFiltersChange, tickets, onClearAll }: TicketsFiltersProps) {
  const [searchQuery, setSearchQuery] = useState(filters.q || "")
  const [statusOpen, setStatusOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [countyOpen, setCountyOpen] = useState(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      onFiltersChange({ q: searchQuery || undefined })
    }, 400)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [searchQuery, onFiltersChange])

  const handleStatusToggle = (status: TicketStatus) => {
    const currentStatuses = filters.status || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status]

    onFiltersChange({
      status: newStatuses.length > 0 ? newStatuses : undefined,
    })
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      onFiltersChange({ q: searchQuery || undefined })
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    onFiltersChange({ q: searchQuery || undefined })
  }

  const uniqueCities = Array.from(new Set(tickets.map((t) => t.site?.city).filter(Boolean))).sort()
  const uniqueCounties = Array.from(new Set(tickets.map((t) => t.site?.county).filter(Boolean))).sort()

  const hasActiveFilters = !!(filters.status?.length || filters.city || filters.county || filters.q)

  const activeFilterCount = [
    filters.status?.length ? 1 : 0,
    filters.city ? 1 : 0,
    filters.county ? 1 : 0,
    filters.q ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0)

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="flex space-x-2">
              <Input
                placeholder="Search by work order, city, or county..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="flex-1"
                aria-label="Search tickets by work order, city, or county"
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </div>
          </form>

          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start bg-transparent min-w-[140px]"
                aria-label={`Filter by status${filters.status?.length ? `, ${filters.status.length} selected` : ""}`}
              >
                <FilterIcon className="mr-2 h-4 w-4" />
                Status
                {filters.status?.length && (
                  <Badge variant="secondary" className="ml-2">
                    {filters.status.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search status..." />
                <CommandList>
                  <CommandEmpty>No status found.</CommandEmpty>
                  <CommandGroup>
                    {STATUS_OPTIONS.map((option) => (
                      <CommandItem key={option.value} onSelect={() => handleStatusToggle(option.value)}>
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            filters.status?.includes(option.value) ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover open={cityOpen} onOpenChange={setCityOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-between min-w-[140px] bg-transparent"
                aria-label={`Filter by city${filters.city ? `, ${filters.city} selected` : ""}`}
              >
                {filters.city || "City"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search cities..." />
                <CommandList>
                  <CommandEmpty>No city found.</CommandEmpty>
                  <CommandGroup>
                    {uniqueCities.map((city) => (
                      <CommandItem
                        key={city}
                        onSelect={() => {
                          onFiltersChange({ city: city === filters.city ? undefined : city })
                          setCityOpen(false)
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", filters.city === city ? "opacity-100" : "opacity-0")} />
                        {city}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover open={countyOpen} onOpenChange={setCountyOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-between min-w-[140px] bg-transparent"
                aria-label={`Filter by county${filters.county ? `, ${filters.county} selected` : ""}`}
              >
                {filters.county || "County"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder="Search counties..." />
                <CommandList>
                  <CommandEmpty>No county found.</CommandEmpty>
                  <CommandGroup>
                    {uniqueCounties.map((county) => (
                      <CommandItem
                        key={county}
                        onSelect={() => {
                          onFiltersChange({ county: county === filters.county ? undefined : county })
                          setCountyOpen(false)
                        }}
                      >
                        <Check
                          className={cn("mr-2 h-4 w-4", filters.county === county ? "opacity-100" : "opacity-0")}
                        />
                        {county}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="outline" onClick={onClearAll}>
              <XIcon className="mr-2 h-4 w-4" />
              Clear All
              {activeFilterCount > 1 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            {filters.status?.map((status) => (
              <Badge key={status} variant="secondary" className="gap-1">
                Status: {getStatusLabel(status)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => handleStatusToggle(status)}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.city && (
              <Badge variant="secondary" className="gap-1">
                City: {filters.city}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => onFiltersChange({ city: undefined })}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.county && (
              <Badge variant="secondary" className="gap-1">
                County: {filters.county}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => onFiltersChange({ county: undefined })}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.q && (
              <Badge variant="secondary" className="gap-1">
                Search: "{filters.q}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => {
                    setSearchQuery("")
                    onFiltersChange({ q: undefined })
                  }}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
