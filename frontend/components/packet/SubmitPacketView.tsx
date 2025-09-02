import type React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"

interface SubmitPacketProps {
  packet: {
    ticket_type: "Normal" | "Emergency" | "NonCompliant" | "SurveyDesign"
    caller_excavator: {
      company?: string
      contact_name?: string
      phone?: string
      email?: string
      onsite_contact_name?: string
      onsite_contact_phone?: string
      onsite_best_time?: string
    }
    work: {
      work_for?: string
      type_of_work?: string
      is_blasting?: boolean
      is_trenchless?: boolean
      depth_inches?: number
      duration_days?: number
      anticipated_completion_at?: string
    }
    location: {
      county?: string
      city?: string
      address?: string
      gps?: string
      cross_street?: string
      subdivision?: string
      lot_block?: string
      driving_directions?: string
      remarks?: string
    }
    map_description: {
      geometry?: any
      geometry_type?: string
      work_area_description?: string
      site_marked_white?: boolean
    }
    dates: {
      requested_at?: string
      desired_start_local?: string
      earliest_lawful_start?: string
      positive_response_at?: string
      expires_at?: string
    }
  }
  mode: "screen" | "print"
  showDisclaimer?: boolean
}

export function SubmitPacketView({ packet, mode, showDisclaimer }: SubmitPacketProps) {
  if (!packet) {
    return <div className="text-sm text-muted-foreground">No packet data available</div>
  }

  // Ensure all nested objects exist with defaults
  const safePacket = {
    ticket_type: packet.ticket_type || "Normal",
    caller_excavator: packet.caller_excavator || {},
    work: packet.work || {},
    location: packet.location || {},
    map_description: packet.map_description || {},
    dates: packet.dates || {},
  }

  const isScreen = mode === "screen"
  const isPrint = mode === "print"

  const SectionWrapper = ({ title, children }: { title: string; children: React.ReactNode }) => {
    if (isScreen) {
      return (
        <Card className="rounded-xl border p-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">{children}</CardContent>
        </Card>
      )
    }

    return (
      <div className="border-b border-gray-300 pb-4 mb-4 print:border-black">
        <h3 className="text-base font-semibold mb-2 print:text-black print:text-xs">{title}</h3>
        {children}
      </div>
    )
  }

  const FieldRow = ({
    label,
    value,
    className = "",
  }: { label: string; value?: string | number | boolean; className?: string }) => {
    if (!value && value !== 0 && value !== false) return null

    let displayValue = value
    if (typeof value === "boolean") {
      displayValue = value ? "Yes" : "No"
    }

    return (
      <div className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 ${className}`}>
        <dt className="text-sm text-muted-foreground font-medium min-w-[120px] print:text-black print:text-xs">
          {label}:
        </dt>
        <dd className="text-sm text-balance break-words print:text-black print:text-xs">{displayValue}</dd>
      </div>
    )
  }

  const getTicketTypeBadge = (type: string) => {
    const colors = {
      Normal: "bg-blue-100 text-blue-800 print:bg-white print:text-black print:border print:border-black",
      Emergency: "bg-red-100 text-red-800 print:bg-white print:text-black print:border print:border-black",
      NonCompliant: "bg-orange-100 text-orange-800 print:bg-white print:text-black print:border print:border-black",
      SurveyDesign: "bg-green-100 text-green-800 print:bg-white print:text-black print:border print:border-black",
    }

    return (
      <Badge className={`h-6 px-2 py-1 text-xs font-medium ${colors[type as keyof typeof colors] || colors.Normal}`}>
        {type}
      </Badge>
    )
  }

  const getGeometryInfo = () => {
    if (!safePacket.map_description.geometry_type) return null

    let info = safePacket.map_description.geometry_type
    if (safePacket.map_description.geometry) {
      const coords = safePacket.map_description.geometry.coordinates
      if (coords) {
        if (safePacket.map_description.geometry_type === "Point") {
          info += " (1 point)"
        } else if (safePacket.map_description.geometry_type === "Polygon" && coords[0]) {
          info += ` (${coords[0].length - 1} vertices)`
        } else if (safePacket.map_description.geometry_type === "LineString") {
          info += ` (${coords.length} points)`
        }
      }
    }
    return info
  }

  const getCoordinates = () => {
    // Check GPS coordinates first
    if (safePacket.location.gps) {
      const coords = safePacket.location.gps.split(",").map((s) => s.trim())
      if (coords.length === 2) {
        const lat = Number.parseFloat(coords[0])
        const lng = Number.parseFloat(coords[1])
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
    }

    // Check geometry centroid
    if (safePacket.map_description.geometry?.coordinates) {
      const coords = safePacket.map_description.geometry.coordinates
      if (safePacket.map_description.geometry_type === "Point") {
        const [lng, lat] = coords
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      } else if (safePacket.map_description.geometry_type === "Polygon" && coords[0]) {
        // Calculate centroid of polygon
        const ring = coords[0]
        let latSum = 0,
          lngSum = 0
        for (const [lng, lat] of ring) {
          latSum += lat
          lngSum += lng
        }
        const lat = latSum / ring.length
        const lng = lngSum / ring.length
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      } else if (safePacket.map_description.geometry_type === "LineString") {
        // Use midpoint of line
        const midIndex = Math.floor(coords.length / 2)
        const [lng, lat] = coords[midIndex]
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
    }

    return null
  }

  const getStaticMapUrl = () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    const coordinates = getCoordinates()

    if (!token || !coordinates) return null

    const { lat, lng } = coordinates
    const zoom = 14
    const width = 400
    const height = 300

    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+ff0000(${lng},${lat})/${lng},${lat},${zoom}/${width}x${height}?access_token=${token}`
  }

  return (
    <div className={`space-y-5 ${isPrint ? "print:space-y-4" : ""}`}>
      {showDisclaimer && (
        <div className="text-xs text-muted-foreground italic text-center print:text-black print:text-[10px]">
          Not an official Texas811 document.
        </div>
      )}

      {/* 1) Ticket Type */}
      <SectionWrapper title="Ticket Type">
        <div className="flex items-center">{getTicketTypeBadge(safePacket.ticket_type)}</div>
      </SectionWrapper>

      {/* 2) Location */}
      <SectionWrapper title="Location">
        <dl className="space-y-2">
          <FieldRow label="County" value={safePacket.location.county} />
          <FieldRow label="City" value={safePacket.location.city} />
          <FieldRow label="Address" value={safePacket.location.address || safePacket.location.gps} />
          <FieldRow label="Cross Street" value={safePacket.location.cross_street} />
          <FieldRow label="Driving Directions" value={safePacket.location.driving_directions} />
          <FieldRow label="Subdivision" value={safePacket.location.subdivision} />
          <FieldRow label="Lot/Block" value={safePacket.location.lot_block} />
          <FieldRow label="Remarks" value={safePacket.location.remarks} />
        </dl>
      </SectionWrapper>

      {/* 3) Map & Locate Instructions */}
      <SectionWrapper title="Map & Locate Instructions">
        <dl className="space-y-2">
          <FieldRow label="Geometry" value={getGeometryInfo()} />
          <FieldRow label="Work Area Description" value={safePacket.map_description.work_area_description} />
          <FieldRow label="White-lined?" value={safePacket.map_description.site_marked_white} />
        </dl>

        {isPrint && getStaticMapUrl() && (
          <div className="mt-4 print:mt-3">
            <img
              src={getStaticMapUrl()! || "/placeholder.svg"}
              alt="Location map"
              className="w-full max-w-md mx-auto border border-gray-300 print:border-black"
              style={{ maxHeight: "300px", objectFit: "contain" }}
            />
            <p className="text-xs text-center text-muted-foreground mt-2 print:text-black print:text-[10px]">
              Map preview for reference only.
            </p>
          </div>
        )}
      </SectionWrapper>

      {/* 4) Work Details */}
      <SectionWrapper title="Work Details">
        <dl className="space-y-2">
          <FieldRow label="Work For" value={safePacket.work.work_for} />
          <FieldRow label="Type of Work" value={safePacket.work.type_of_work} />
          <FieldRow label="Explosives?" value={safePacket.work.is_blasting} />
          <FieldRow label="Trenchless?" value={safePacket.work.is_trenchless} />
          <FieldRow
            label="Depth"
            value={
              safePacket.work.depth_inches
                ? `${safePacket.work.depth_inches} in`
                : safePacket.work.depth_inches === 0
                  ? "0 in"
                  : ">16 in"
            }
          />
          <FieldRow
            label="Duration"
            value={safePacket.work.duration_days ? `${safePacket.work.duration_days} days` : undefined}
          />
          <FieldRow
            label="Anticipated Completion"
            value={
              safePacket.work.anticipated_completion_at
                ? formatDate(safePacket.work.anticipated_completion_at)
                : undefined
            }
          />
        </dl>
      </SectionWrapper>

      {/* 5) Caller/Excavator */}
      <SectionWrapper title="Caller/Excavator">
        <dl className="space-y-2">
          <FieldRow label="Company" value={safePacket.caller_excavator.company} />
          <FieldRow label="Contact" value={safePacket.caller_excavator.contact_name} />
          <FieldRow label="Phone" value={safePacket.caller_excavator.phone} />
          <FieldRow label="Email" value={safePacket.caller_excavator.email} />
          <FieldRow label="On-site Contact" value={safePacket.caller_excavator.onsite_contact_name} />
          <FieldRow label="On-site Phone" value={safePacket.caller_excavator.onsite_contact_phone} />
          <FieldRow label="Best Time" value={safePacket.caller_excavator.onsite_best_time} />
        </dl>
      </SectionWrapper>

      {/* 6) Dates */}
      <SectionWrapper title="Dates">
        <dl className="space-y-2">
          <FieldRow
            label="Requested"
            value={safePacket.dates.requested_at ? formatDate(safePacket.dates.requested_at) : undefined}
          />
          <FieldRow
            label="Desired Start"
            value={safePacket.dates.desired_start_local ? formatDate(safePacket.dates.desired_start_local) : undefined}
          />
          <FieldRow
            label="Earliest Lawful Start"
            value={
              safePacket.dates.earliest_lawful_start ? formatDate(safePacket.dates.earliest_lawful_start) : undefined
            }
          />
          <FieldRow
            label="Positive Response"
            value={
              safePacket.dates.positive_response_at ? formatDate(safePacket.dates.positive_response_at) : undefined
            }
          />
          <FieldRow
            label="Expires"
            value={safePacket.dates.expires_at ? formatDate(safePacket.dates.expires_at) : undefined}
          />
        </dl>
      </SectionWrapper>
    </div>
  )
}
