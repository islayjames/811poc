"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusPill } from "@/components/tickets/status-pill"
import { ResponsesSection } from "@/components/tickets/ResponsesSection"
import { api, ApiError } from "@/lib/api"
import { GeoMapBox } from "@/components/map/GeoMapBox"
import {
  formatTicketId,
  canConfirm,
  canMarkSubmitted,
  canMarkResponsesIn,
  formatRelativeTime,
  isWithinDays,
} from "@/lib/format"
import type { TicketDetail } from "@/lib/types"
import { SubmitPacketView } from "@/components/packet/SubmitPacketView"
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  AlertTriangleIcon,
  CopyIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExpandIcon,
  RefreshCwIcon,
  AwardIcon as IdCardIcon,
  MapIcon,
  CheckCircleIcon,
  HardHatIcon,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function TicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string
  const { toast } = useToast()

  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showMoreSummary, setShowMoreSummary] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
  }>({
    open: false,
    title: "",
    description: "",
    action: async () => {},
  })

  // Prevent infinite refresh loops
  const fetchingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const tab = urlParams.get("tab")
    if (tab && ["overview", "packet"].includes(tab)) {
      setActiveTab(tab)
    }
  }, [])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", value)
    window.history.replaceState(null, "", url.toString())
  }

  const fetchTicket = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      console.log('[TicketDetail] Fetch already in progress, skipping...')
      return
    }

    fetchingRef.current = true

    try {
      setLoading(true)
      setError(null)
      console.log(`[TicketDetail] Fetching ticket ${ticketId}...`)
      const response = await api.getTicket(ticketId)

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setTicket(response)
        console.log(`[TicketDetail] Ticket ${ticketId} loaded, responses:`, response.responses?.length || 0)
      }
    } catch (err) {
      console.error(`[TicketDetail] Error loading ticket ${ticketId}:`, err)
      if (mountedRef.current) {
        setError(err instanceof ApiError ? err.message : "Failed to load ticket")
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
      fetchingRef.current = false
    }
  }, [ticketId])

  const handleAction = async (
    action: string,
    apiCall: () => Promise<void>,
    confirmTitle: string,
    confirmDescription: string,
  ) => {
    setConfirmDialog({
      open: true,
      title: confirmTitle,
      description: confirmDescription,
      action: async () => {
        if (!ticket) return
        try {
          setActionLoading(action)
          await apiCall()
          await fetchTicket()
          toast({
            title: "Success",
            description: `Ticket ${action.toLowerCase()} successfully`,
          })
        } catch (err) {
          toast({
            title: "Error",
            description: err instanceof ApiError ? err.message : `Failed to ${action.toLowerCase()} ticket`,
            variant: "destructive",
          })
        } finally {
          setActionLoading(null)
          setConfirmDialog((prev) => ({ ...prev, open: false }))
        }
      },
    })
  }

  const copyToClipboard = async (text: string, description = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied",
        description,
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  // Track component mount/unmount
  useEffect(() => {
    mountedRef.current = true
    console.log('[TicketDetail] Component mounted')
    return () => {
      mountedRef.current = false
      fetchingRef.current = false
      console.log('[TicketDetail] Component unmounted')
    }
  }, [])

  // Fetch ticket on mount or when ticketId changes
  useEffect(() => {
    console.log('[TicketDetail] useEffect triggered for fetchTicket')
    fetchTicket()
  }, [fetchTicket])

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b h-14 flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/tickets')}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto py-5 space-y-5">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangleIcon className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error Loading Ticket</AlertTitle>
            <AlertDescription className="text-red-700 mt-2">
              Unable to load ticket details. Please try again or return to the ticket list.
              <div className="flex items-center space-x-3 mt-3">
                <Button size="sm" onClick={fetchTicket} variant="outline">
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button size="sm" onClick={() => router.push("/tickets")} variant="outline">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to List
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b h-14 flex items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-16" /> {/* Back button */}
            <Skeleton className="h-6 w-20" /> {/* Short ID */}
            <Skeleton className="h-6 w-16 rounded-full" /> {/* Status pill */}
            <Skeleton className="h-6 w-20 rounded-md" /> {/* Type chip */}
          </div>
          <div className="flex items-center space-x-3">
            <Skeleton className="h-6 w-28 rounded-md" /> {/* Earliest Start chip */}
            <Skeleton className="h-6 w-24 rounded-md" /> {/* Expires chip */}
            <Skeleton className="h-8 w-32" /> {/* Primary action */}
            <Skeleton className="h-8 w-24" /> {/* Print button */}
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto py-5 space-y-5">
          <div className="border-b">
            <div className="flex space-x-8">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>

          <div className="space-y-5">
            {/* Summary skeleton */}
            <div className="rounded-xl border p-4 space-y-4">
              <Skeleton className="h-5 w-20" /> {/* Title */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, groupIndex) => (
                  <div key={groupIndex} className="space-y-3">
                    <Skeleton className="h-4 w-16" /> {/* Group title */}
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex flex-col space-y-1">
                          <Skeleton className="h-3 w-20" /> {/* Label */}
                          <Skeleton className="h-3 w-full" /> {/* Value */}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map skeleton */}
            <div className="rounded-xl border p-4 space-y-4">
              <Skeleton className="h-5 w-32" /> {/* Title */}
              <Skeleton className="w-full h-[360px] rounded-md" /> {/* Map */}
              <div className="flex items-center space-x-4">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>

            {/* Responses skeleton */}
            <div className="rounded-xl border p-4 space-y-4">
              <Skeleton className="h-5 w-32" /> {/* Title */}
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline skeleton */}
            <div className="rounded-xl border p-4 space-y-4">
              <Skeleton className="h-5 w-28" /> {/* Title */}
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b h-14 flex items-center px-6">
          <Button variant="outline" size="sm" onClick={() => router.push('/tickets')}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="max-w-screen-xl mx-auto py-5">
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Unable to load ticket</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">{error || "Ticket not found or failed to load"}</p>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={fetchTicket}>
                  <RefreshCwIcon className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/tickets")}>
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Back to List
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  const getPrimaryAction = () => {
    if (canConfirm(ticket.status)) {
      return {
        label: "Confirm & Lock",
        action: () =>
          handleAction(
            "Confirmed",
            () => api.confirmTicket(ticket.id),
            "Confirm & Lock Ticket",
            "This will confirm the ticket and lock it from further changes. Are you sure?",
          ),
        loading: actionLoading === "Confirmed",
      }
    }
    if (canMarkSubmitted(ticket.status)) {
      return {
        label: "Mark Submitted",
        action: () =>
          handleAction(
            "Submitted",
            () => api.markSubmitted(ticket.id),
            "Mark as Submitted",
            "This will mark the ticket as submitted to utilities. Are you sure?",
          ),
        loading: actionLoading === "Submitted",
      }
    }
    if (canMarkResponsesIn(ticket.status)) {
      return {
        label: "Positive Responses Received",
        action: () =>
          handleAction(
            "Responses Received",
            () => api.markResponsesIn(ticket.id),
            "Mark Positive Responses Received",
            "This will mark that positive responses have been received from utilities. Are you sure?",
          ),
        loading: actionLoading === "Responses Received",
      }
    }
    return null
  }

  const primaryAction = getPrimaryAction()

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Left cluster */}
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/tickets')}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="flex items-center space-x-1">
              <span className="font-mono text-sm font-semibold">{formatTicketId(ticket.id)}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(ticket.id)}>
                <CopyIcon className="h-3 w-3" />
              </Button>
            </div>

            <div className="h-4 w-px bg-border" />

            <StatusPill status={ticket.status} />

            <div className="h-4 w-px bg-border" />

            <Badge variant="outline" className="text-xs px-2 py-1 h-6 rounded-md">
              {ticket.ticket_type_hint}
            </Badge>
          </div>

          {/* Right cluster */}
          <div className="flex items-center space-x-4">
            {/* Date chip A: Earliest Start */}
            {ticket.dates?.earliest_lawful_start && (
              <div
                className={`flex items-center space-x-2 text-xs px-2 py-1 rounded-md border ${
                  new Date(ticket.dates.earliest_lawful_start) < new Date()
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                <ClockIcon className="h-3 w-3" />
                <span title={new Date(ticket.dates.earliest_lawful_start).toISOString()}>
                  {formatRelativeTime(ticket.dates.earliest_lawful_start)}
                </span>
              </div>
            )}

            {/* Date chip B: Expires */}
            {ticket.dates?.expires_at ? (
              <div
                className={`flex items-center space-x-2 text-xs px-2 py-1 rounded-md border ${
                  isWithinDays(ticket.dates.expires_at, 3)
                    ? "border-orange-300 bg-orange-50 text-orange-800"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                <CalendarIcon className="h-3 w-3" />
                <span title={new Date(ticket.dates.expires_at).toISOString()}>
                  {formatRelativeTime(ticket.dates.expires_at)}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-gray-700">
                <CalendarIcon className="h-3 w-3" />
                <span>—</span>
              </div>
            )}

            {/* Primary action button */}
            {primaryAction && (
              <Button size="sm" onClick={primaryAction.action} disabled={!!actionLoading}>
                {primaryAction.loading ? "Processing..." : primaryAction.label}
              </Button>
            )}

            {/* Secondary: Print Ticket */}
            <Button variant="outline" size="sm" onClick={() => window.open(`/tickets/${ticket.id}/print`, "_blank")}>
              Print Ticket
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto py-5 space-y-5">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Overview
            </TabsTrigger>
            <TabsTrigger value="packet" className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Packet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 max-h-[calc(100vh-200px)] overflow-auto space-y-5">
            <div className="flex items-center space-x-2 pb-4 border-b">
              <span className="text-sm text-muted-foreground mr-2">Jump to:</span>
              <button
                onClick={() => document.getElementById("responses")?.scrollIntoView({ behavior: "smooth" })}
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
              >
                Responses
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" })}
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
              >
                Summary
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => document.getElementById("map")?.scrollIntoView({ behavior: "smooth" })}
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
              >
                Map & Location
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => document.getElementById("work-description")?.scrollIntoView({ behavior: "smooth" })}
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
              >
                Work Details
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" })}
                className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
              >
                Timeline
              </button>
            </div>

            {/* Utility Responses Section - Moved to top */}
            <ResponsesSection ticketId={ticket.id} ticket={ticket} initialResponses={ticket.responses} />

            {/* Current Summary Section */}
            <Card id="summary" className="rounded-xl border p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-base font-semibold flex items-center space-x-2">
                  <IdCardIcon className="h-4 w-4" />
                  <span>Current Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-12 gap-6">
                  {/* Group 1: Caller */}
                  {(ticket.excavator?.company ||
                    ticket.excavator?.contact_name ||
                    ticket.excavator?.phone ||
                    ticket.excavator?.email) && (
                    <div className="col-span-12 lg:col-span-4">
                      <h4 className="text-base font-semibold mb-3">Caller</h4>
                      <dl className="grid grid-cols-1 gap-y-2">
                        {ticket.excavator?.company && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Company</dt>
                            <dd className="text-sm text-balance break-words">{ticket.excavator.company}</dd>
                          </div>
                        )}
                        {ticket.excavator?.contact_name && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Contact</dt>
                            <dd className="text-sm text-balance break-words">{ticket.excavator.contact_name}</dd>
                          </div>
                        )}
                        {ticket.excavator?.phone && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Phone</dt>
                            <dd className="text-sm text-balance break-words">{ticket.excavator.phone}</dd>
                          </div>
                        )}
                        {ticket.excavator?.email && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Email</dt>
                            <dd className="text-sm text-balance break-words">{ticket.excavator.email}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Group 2: Work */}
                  {(ticket.work?.work_for ||
                    ticket.work?.type_of_work ||
                    ticket.work?.is_trenchless ||
                    ticket.work?.is_blasting ||
                    ticket.work?.depth_inches ||
                    ticket.work?.duration_days) && (
                    <div className="col-span-12 lg:col-span-4">
                      <h4 className="text-base font-semibold mb-3">Work</h4>
                      <dl className="grid grid-cols-1 gap-y-2">
                        {ticket.work?.work_for && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Work For</dt>
                            <dd className="text-sm text-balance break-words">{ticket.work.work_for}</dd>
                          </div>
                        )}
                        {ticket.work?.type_of_work && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">
                              Type of Work
                            </dt>
                            <dd className="text-sm text-balance break-words">{ticket.work.type_of_work}</dd>
                          </div>
                        )}
                        {(ticket.work?.is_trenchless || ticket.work?.is_blasting) && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Methods</dt>
                            <dd className="text-sm flex items-center space-x-2">
                              {ticket.work?.is_trenchless && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs px-2 py-1 h-5 rounded-md bg-blue-50 text-blue-800 border-blue-200"
                                >
                                  Trenchless
                                </Badge>
                              )}
                              {ticket.work?.is_blasting && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs px-2 py-1 h-5 rounded-md bg-orange-50 text-orange-800 border-orange-200"
                                >
                                  Blasting
                                </Badge>
                              )}
                            </dd>
                          </div>
                        )}
                        {ticket.work?.depth_inches && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Depth (in)</dt>
                            <dd className="text-sm text-balance break-words">{ticket.work.depth_inches}</dd>
                          </div>
                        )}
                        {ticket.work?.duration_days && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">
                              Duration (days)
                            </dt>
                            <dd className="text-sm text-balance break-words">{ticket.work.duration_days}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Group 3: Location */}
                  {(ticket.site?.address ||
                    (ticket.site?.gps?.lat && ticket.site?.gps?.lng) ||
                    ticket.site?.cross_street ||
                    ticket.site?.county ||
                    ticket.site?.city) && (
                    <div className="col-span-12 lg:col-span-4">
                      <h4 className="text-base font-semibold mb-3">Location</h4>
                      <dl className="grid grid-cols-1 gap-y-2">
                        {ticket.site?.address && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">Address</dt>
                            <dd className="text-sm text-balance break-words flex items-start space-x-2">
                              <span className="flex-1">{ticket.site.address}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 flex-shrink-0"
                                onClick={() => copyToClipboard(ticket.site.address, "Address copied to clipboard")}
                              >
                                <CopyIcon className="h-3 w-3" />
                              </Button>
                            </dd>
                          </div>
                        )}
                        {ticket.site?.gps?.lat && ticket.site?.gps?.lng && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">GPS</dt>
                            <dd className="text-sm">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      `${ticket.site.gps.lat}, ${ticket.site.gps.lng}`,
                                      "GPS coordinates copied to clipboard",
                                    )
                                  }
                                  className="font-mono hover:bg-gray-100 px-1 py-0.5 rounded text-xs flex items-center space-x-1"
                                  title="Click to copy coordinates"
                                >
                                  <span>
                                    {ticket.site.gps.lat}, {ticket.site.gps.lng}
                                  </span>
                                  <CopyIcon className="h-3 w-3" />
                                </button>
                                <a
                                  href={`https://maps.google.com/?q=${encodeURIComponent(
                                    [ticket.site.address, ticket.site.city, ticket.site.county, 'TX'].filter(Boolean).join(', ')
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-xs underline"
                                >
                                  Open in Maps
                                </a>
                              </div>
                            </dd>
                          </div>
                        )}
                        {ticket.site?.cross_street && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">
                              Cross Street
                            </dt>
                            <dd className="text-sm text-balance break-words">{ticket.site.cross_street}</dd>
                          </div>
                        )}
                        {ticket.site?.county && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">County</dt>
                            <dd className="text-sm text-balance break-words">{ticket.site.county}</dd>
                          </div>
                        )}
                        {ticket.site?.city && (
                          <div className="flex flex-col md:flex-row md:items-start">
                            <dt className="text-sm text-muted-foreground md:w-[120px] md:flex-shrink-0">City</dt>
                            <dd className="text-sm text-balance break-words">{ticket.site.city}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </div>

                {/* Show more section for optional fields */}
                {showMoreSummary && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="text-base font-semibold mb-3">Additional Details</h4>
                    <dl className="grid grid-cols-1 gap-y-4 max-w-none">
                      {ticket.site?.subdivision && (
                        <div className="flex flex-col">
                          <dt className="text-sm text-muted-foreground font-medium mb-1">Subdivision</dt>
                          <dd className="text-sm">{ticket.site.subdivision}</dd>
                        </div>
                      )}
                      {ticket.site?.lot_block && (
                        <div className="flex flex-col">
                          <dt className="text-sm text-muted-foreground font-medium mb-1">Lot/Block</dt>
                          <dd className="text-sm">{ticket.site.lot_block}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}

                {/* Show more/less toggle */}
                {(ticket.site?.subdivision || ticket.site?.lot_block) && (
                  <div className="mt-4 pt-4 border-t">
                    <button
                      onClick={() => setShowMoreSummary(!showMoreSummary)}
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showMoreSummary ? (
                        <>
                          <ChevronUpIcon className="h-4 w-4" />
                          <span>Show less</span>
                        </>
                      ) : (
                        <>
                          <ChevronDownIcon className="h-4 w-4" />
                          <span>Show more</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Map and Location Section */}
            <Card id="map" className="rounded-xl border p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapIcon className="h-4 w-4" />
                    <span>Map and Location</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowMapModal(true)} className="h-8 w-8 p-0">
                    <ExpandIcon className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full">
                  <div className="relative w-full" style={{ aspectRatio: "3/2", height: "360px" }}>
                    <GeoMapBox
                      geometry={ticket.geom?.geojson ?? null}
                      gps={ticket.site?.gps ?? { lat: null, lng: null }}
                      address={ticket.site?.address}
                      height={360}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs py-3 border-t border-b my-4">
                  {ticket.geom?.geojson && (
                    <Badge variant="outline" className="text-xs px-2 py-1 h-5 rounded-md">
                      {ticket.geom.geojson.type === "FeatureCollection"
                        ? ticket.geom.geojson.features[0]?.geometry?.type || "Unknown"
                        : ticket.geom.geojson.geometry?.type || ticket.geom.geojson.type || "Unknown"}
                    </Badge>
                  )}

                  {ticket.geom?.geojson && (
                    <span className="text-muted-foreground">
                      {ticket.geom.geojson.type === "Polygon" && ticket.geom.geojson.coordinates?.[0]
                        ? `${ticket.geom.geojson.coordinates[0].length} vertices`
                        : ticket.geom.geojson.type === "Point"
                          ? "Point"
                          : ticket.geom.geojson.type === "FeatureCollection" &&
                              ticket.geom.geojson.features[0]?.geometry?.type === "Point"
                            ? "Point"
                            : ticket.geom.geojson.type === "FeatureCollection" &&
                                ticket.geom.geojson.features[0]?.geometry?.type === "Polygon"
                              ? `${ticket.geom.geojson.features[0]?.geometry?.coordinates?.[0]?.length || 0} vertices`
                              : ""}
                    </span>
                  )}

                  {ticket.geom?.confidence !== null && ticket.geom?.confidence !== undefined && (
                    <span
                      className={`font-medium ${ticket.geom.confidence < 0.8 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {Math.round(ticket.geom.confidence * 100)}% confidence
                    </span>
                  )}

                  {ticket.geom?.warnings?.length && (
                    <div className="flex items-center space-x-1 text-amber-600" title={ticket.geom.warnings.join("; ")}>
                      <AlertTriangleIcon className="h-3 w-3" />
                      <span>
                        {ticket.geom.warnings.length} warning{ticket.geom.warnings.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {ticket.site?.driving_directions && (
                    <div className="max-w-prose">
                      <label className="text-sm text-muted-foreground font-medium">Driving Directions</label>
                      <p className="text-sm mt-1 leading-5">{ticket.site.driving_directions}</p>
                    </div>
                  )}

                  {ticket.site?.work_area_description && (
                    <div className="max-w-prose">
                      <label className="text-sm text-muted-foreground font-medium">Work Area Description</label>
                      <p className="text-sm mt-1 leading-5">{ticket.site.work_area_description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Work Description Section */}
            <Card id="work-description" className="rounded-xl border p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-base font-semibold flex items-center space-x-2">
                  <HardHatIcon className="h-4 w-4" />
                  <span>Work Description</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    {ticket.site?.marking_instructions && (
                      <div>
                        <label className="text-sm text-muted-foreground font-medium">Locate Instructions</label>
                        <p className="text-sm mt-1 leading-5">{ticket.site.marking_instructions}</p>
                      </div>
                    )}

                    {ticket.site?.remarks && (
                      <div>
                        <label className="text-sm text-muted-foreground font-medium">Additional Remarks</label>
                        <p className="text-sm mt-1 leading-5">{ticket.site.remarks}</p>
                      </div>
                    )}

                    {ticket.excavator?.company && (
                      <div>
                        <label className="text-sm text-muted-foreground font-medium">Work For</label>
                        <p className="text-sm mt-1">{ticket.excavator.company}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    {ticket.work?.type_of_work && (
                      <div>
                        <label className="text-sm text-muted-foreground font-medium">Equipment Type</label>
                        <p className="text-sm mt-1">{ticket.work.type_of_work}</p>
                      </div>
                    )}

                    {ticket.work?.work_for && (
                      <div>
                        <label className="text-sm text-muted-foreground font-medium">Nature of Work</label>
                        <p className="text-sm mt-1">{ticket.work.work_for}</p>
                      </div>
                    )}

                    {/* Duration, Explosives, White Lining Flags */}
                    <div className="space-y-2">
                      {ticket.work?.duration_days && (
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-muted-foreground font-medium">Duration</label>
                          <span className="text-sm">{ticket.work.duration_days} days</span>
                        </div>
                      )}

                      {ticket.work?.is_blasting !== undefined && (
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-muted-foreground font-medium">Explosives</label>
                          <Badge
                            variant={ticket.work.is_blasting ? "destructive" : "secondary"}
                            className="text-xs px-2 py-1 h-5 rounded-md"
                          >
                            {ticket.work.is_blasting ? "Yes" : "No"}
                          </Badge>
                        </div>
                      )}

                      {/* White lining flags - placeholder for future implementation */}
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-muted-foreground font-medium">White Lining Flags</label>
                        <Badge variant="secondary" className="text-xs px-2 py-1 h-5 rounded-md">
                          Standard
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* No work description available */}
                {!ticket.site?.marking_instructions &&
                 !ticket.site?.remarks &&
                 !ticket.excavator?.company &&
                 !ticket.work?.type_of_work &&
                 !ticket.work?.work_for &&
                 !ticket.work?.duration_days &&
                 ticket.work?.is_blasting === undefined && (
                  <div className="text-center py-8">
                    <h3 className="text-base font-semibold mb-2">No work description details available</h3>
                    <p className="text-sm text-muted-foreground">
                      Work description information will appear here when available.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Timeline Section */}
            <Card id="timeline" className="rounded-xl border p-4">
              <CardHeader className="p-0 pb-2">
                <CardTitle className="text-base font-semibold flex items-center space-x-2">
                  <ClockIcon className="h-4 w-4" />
                  <span>Status Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ticket.audit_log && ticket.audit_log.length > 0 ? (
                  <div className="space-y-4">
                    {(() => {
                      // Group entries by date, newest first
                      const sortedEntries = [...ticket.audit_log].sort(
                        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
                      )

                      const groupedEntries = sortedEntries.reduce(
                        (groups, entry) => {
                          const date = new Date(entry.timestamp).toLocaleDateString()
                          if (!groups[date]) groups[date] = []
                          groups[date].push(entry)
                          return groups
                        },
                        {} as Record<string, typeof ticket.audit_log>,
                      )

                      return Object.entries(groupedEntries).map(([date, entries]) => (
                        <div key={date}>
                          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">{date}</div>
                          <div className="space-y-2">
                            {entries.map((entry, index) => (
                              <div key={index} className="flex items-center space-x-3 py-2">
                                <div
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    entry.to_status === "ValidPendingConfirm"
                                      ? "bg-blue-500"
                                      : entry.to_status === "Ready"
                                        ? "bg-green-500"
                                        : entry.to_status === "Submitted"
                                          ? "bg-yellow-500"
                                          : entry.to_status === "ResponsesIn"
                                            ? "bg-purple-500"
                                            : entry.to_status === "Cancelled"
                                              ? "bg-red-500"
                                              : entry.to_status === "Expired"
                                                ? "bg-gray-500"
                                                : "bg-gray-400"
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-3 text-sm">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(entry.timestamp).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    <span className="font-mono text-xs">
                                      {entry.from_status} → {entry.to_status}
                                    </span>
                                    {entry.actor && (
                                      <Badge variant="outline" className="text-xs px-2 py-0 h-5 rounded-md">
                                        {entry.actor}
                                      </Badge>
                                    )}
                                  </div>
                                  {entry.note && (
                                    <p className="text-xs text-muted-foreground mt-1 ml-0">{entry.note}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <h3 className="text-base font-semibold mb-2">No status changes recorded</h3>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="packet" className="mt-6 max-h-[calc(100vh-200px)] overflow-auto">
            <SubmitPacketView packet={ticket.submit_packet} mode="screen" showDisclaimer />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showMapModal} onOpenChange={setShowMapModal} onEscapeKeyDown={() => setShowMapModal(false)}>
        <DialogContent className="max-w-6xl w-full h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MapPinIcon className="h-4 w-4" />
              <span>Ticket {formatTicketId(ticket.id)} - Map View</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <GeoMapBox
              geometry={ticket.geom?.geojson ?? null}
              gps={ticket.site?.gps ?? { lat: null, lng: null }}
              address={ticket.site?.address}
              height={500}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button onClick={confirmDialog.action} disabled={!!actionLoading}>
              {actionLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
