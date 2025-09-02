"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation } from "lucide-react"

interface GeoMapProps {
  geojson?: any // GeoJSON Feature or FeatureCollection
  gpsCoordinates?: { lat: number; lng: number } | null
  className?: string
  height?: string
}

export function GeoMap({ geojson, gpsCoordinates, className = "", height = "h-64" }: GeoMapProps) {
  const renderGeometryInfo = () => {
    if (geojson) {
      const geometry = geojson.geometry || geojson
      const properties = geojson.properties || {}

      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            <Badge variant="outline">{geometry.type}</Badge>
          </div>

          {geometry.type === "Point" && geometry.coordinates && (
            <div className="text-sm text-muted-foreground">
              <div>
                Coordinates: {geometry.coordinates[1]?.toFixed(6)}, {geometry.coordinates[0]?.toFixed(6)}
              </div>
              <div className="text-xs mt-1">Approximate 35ft work area</div>
            </div>
          )}

          {geometry.type === "Polygon" && geometry.coordinates && (
            <div className="text-sm text-muted-foreground">
              <div>Polygon with {geometry.coordinates[0]?.length || 0} vertices</div>
              <div className="text-xs mt-1">Work area boundary defined</div>
            </div>
          )}

          {geometry.type === "LineString" && geometry.coordinates && (
            <div className="text-sm text-muted-foreground">
              <div>Line with {geometry.coordinates.length} points</div>
              <div className="text-xs mt-1">Linear work area (with buffer)</div>
            </div>
          )}

          {Object.keys(properties).length > 0 && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              {Object.entries(properties).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}:</strong> {String(value)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (gpsCoordinates?.lat && gpsCoordinates?.lng) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-blue-600" />
            <Badge variant="outline">GPS Point</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <div>
              Coordinates: {gpsCoordinates.lat.toFixed(6)}, {gpsCoordinates.lng.toFixed(6)}
            </div>
            <div className="text-xs mt-1">Approximate 35ft work area</div>
          </div>
        </div>
      )
    }

    return (
      <div className="text-center text-muted-foreground">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <div className="text-sm">No location data available</div>
      </div>
    )
  }

  return (
    <Card className={`${height} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Location Information</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{renderGeometryInfo()}</CardContent>
    </Card>
  )
}
