"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { TicketsTable } from "@/components/tickets/tickets-table"
import { TicketsFilters } from "@/components/tickets/tickets-filters"
import { TicketsTableSkeleton } from "@/components/tickets/tickets-table-skeleton"
import { ApiError } from "@/lib/api"
import type { TicketListItem, TicketFilters, TicketStatus } from "@/lib/types"

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [10, 25, 50]

export default function TicketsListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tableRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasEverHadTickets, setHasEverHadTickets] = useState(false)

  const [ariaLiveMessage, setAriaLiveMessage] = useState("")

  const [currentPage, setCurrentPage] = useState(() => {
    return Number.parseInt(searchParams.get("page") || "1", 10)
  })

  const [pageSize, setPageSize] = useState(() => {
    const size = Number.parseInt(searchParams.get("pageSize") || DEFAULT_PAGE_SIZE.toString(), 10)
    return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE
  })

  const [statusFilter, setStatusFilter] = useState<TicketStatus[] | undefined>(() => {
    const statusParams = searchParams.getAll("status") as TicketStatus[]
    return statusParams.length > 0 ? statusParams : undefined
  })
  const [cityFilter, setCityFilter] = useState<string | undefined>(() => {
    return searchParams.get("city") || undefined
  })
  const [countyFilter, setCountyFilter] = useState<string | undefined>(() => {
    return searchParams.get("county") || undefined
  })
  const [searchFilter, setSearchFilter] = useState<string | undefined>(() => {
    return searchParams.get("q") || undefined
  })

  const [sortBy, setSortBy] = useState<"earliest_start" | "expires" | "status">(() => {
    const sort = searchParams.get("sort") as "earliest_start" | "expires" | "status"
    return sort || "earliest_start"
  })
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    const dir = searchParams.get("dir") as "asc" | "desc"
    return dir || "asc"
  })

  const fetchTickets = async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()

      if (statusFilter?.length) {
        statusFilter.forEach((status) => queryParams.append("status", status))
      }
      if (cityFilter) queryParams.set("city", cityFilter)
      if (countyFilter) queryParams.set("county", countyFilter)
      if (searchFilter) queryParams.set("q", searchFilter)

      queryParams.set("page", currentPage.toString())
      queryParams.set("pageSize", pageSize.toString())
      queryParams.set("sort", sortBy)
      queryParams.set("dir", sortOrder)

      const apiUrl = `/api/tickets?${queryParams.toString()}`

      const response = await fetch(apiUrl, {
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error("Failed to fetch tickets")
      }

      const data = await response.json()

      setTickets(data.tickets)
      setTotal(data.total)

      setTimeout(() => {
        setAriaLiveMessage(`${data.total} ticket${data.total !== 1 ? "s" : ""} found`)
      }, 100)

      if (data.total > 0) {
        setHasEverHadTickets(true)
      }

      if (tableRef.current) {
        const rect = tableRef.current.getBoundingClientRect()
        if (rect.top < 0) {
          tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      setError(err instanceof ApiError ? err.message : "Failed to load tickets")
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  const updateURL = (
    newStatusFilter?: TicketStatus[],
    newCityFilter?: string,
    newCountyFilter?: string,
    newSearchFilter?: string,
    newSortBy?: string,
    newSortOrder?: string,
    newPage?: number,
    newPageSize?: number,
  ) => {
    const params = new URLSearchParams()

    const status = newStatusFilter !== undefined ? newStatusFilter : statusFilter
    const city = newCityFilter !== undefined ? newCityFilter : cityFilter
    const county = newCountyFilter !== undefined ? newCountyFilter : countyFilter
    const search = newSearchFilter !== undefined ? newSearchFilter : searchFilter

    if (status?.length) {
      status.forEach((s) => params.append("status", s))
    }
    if (city) params.set("city", city)
    if (county) params.set("county", county)
    if (search) params.set("q", search)

    params.set("page", (newPage || currentPage).toString())
    params.set("pageSize", (newPageSize || pageSize).toString())

    params.set("sort", newSortBy || sortBy)
    params.set("dir", newSortOrder || sortOrder)

    router.push(`/tickets?${params.toString()}`)
  }

  const handleFiltersChange = (newFilters: Partial<TicketFilters>) => {
    if (newFilters.status !== undefined) setStatusFilter(newFilters.status)
    if (newFilters.city !== undefined) setCityFilter(newFilters.city)
    if (newFilters.county !== undefined) setCountyFilter(newFilters.county)
    if (newFilters.q !== undefined) setSearchFilter(newFilters.q)

    setCurrentPage(1)
    updateURL(newFilters.status, newFilters.city, newFilters.county, newFilters.q, undefined, undefined, 1)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    updateURL(undefined, undefined, undefined, undefined, undefined, undefined, newPage)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPage(1)
    setPageSize(newPageSize)
    updateURL(undefined, undefined, undefined, undefined, undefined, undefined, 1, newPageSize)
  }

  const handleRowClick = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`)
  }

  const handleSort = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy as "earliest_start" | "expires" | "status")
    setSortOrder(newSortOrder as "asc" | "desc")
    updateURL(undefined, undefined, undefined, undefined, newSortBy, newSortOrder)
  }

  const clearAllFilters = () => {
    setStatusFilter(undefined)
    setCityFilter(undefined)
    setCountyFilter(undefined)
    setSearchFilter(undefined)
    setSortBy("earliest_start")
    setSortOrder("asc")
    setCurrentPage(1)
    updateURL(undefined, undefined, undefined, undefined, "earliest_start", "asc", 1)
  }

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, cityFilter, countyFilter, searchFilter, sortBy, sortOrder, currentPage, pageSize])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const totalPages = Math.ceil(total / pageSize)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  const hasActiveFilters = () => {
    return !!(statusFilter?.length || cityFilter || countyFilter || searchFilter)
  }

  const getEmptyStateMessage = () => {
    if (hasActiveFilters()) {
      return {
        title: "No tickets match your filters",
        description: "Clear filters to see all tickets.",
        showClearButton: true,
      }
    } else if (!hasEverHadTickets && total === 0) {
      return {
        title: "No tickets yet",
        description: "When your CustomGPT confirms a ticket, it will appear here.",
        showClearButton: false,
      }
    } else {
      return {
        title: "No tickets found",
        description: "There are no tickets in the system yet.",
        showClearButton: false,
      }
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {ariaLiveMessage}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">Manage utility locate tickets and track their status</p>
        </div>
      </div>

      <TicketsFilters
        filters={{
          status: statusFilter,
          city: cityFilter,
          county: countyFilter,
          q: searchFilter,
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        }}
        onFiltersChange={handleFiltersChange}
        tickets={tickets}
        onClearAll={clearAllFilters}
      />

      <Card ref={tableRef}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {loading ? <Skeleton className="h-6 w-32" /> : `${total} ticket${total !== 1 ? "s" : ""}`}
            </CardTitle>
            {total > 0 && (
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={fetchTickets}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading ? (
            <TicketsTableSkeleton />
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-muted-foreground/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              {(() => {
                const emptyState = getEmptyStateMessage()
                return (
                  <>
                    <h3 className="text-lg font-medium mb-2">{emptyState.title}</h3>
                    <p className="text-muted-foreground mb-4">{emptyState.description}</p>
                    {emptyState.showClearButton && (
                      <Button variant="outline" onClick={clearAllFilters}>
                        Clear filters to see all
                      </Button>
                    )}
                  </>
                )
              })()}
            </div>
          ) : (
            <>
              <TicketsTable
                tickets={tickets}
                onRowClick={handleRowClick}
                onSort={handleSort}
                sortBy={sortBy}
                sortOrder={sortOrder}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {startItem} to {endItem} of {total} results
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Show:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(Number.parseInt(e.target.value, 10))}
                        className="text-sm border border-input bg-background px-2 py-1 rounded-md"
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!hasPrevPage}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!hasNextPage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
