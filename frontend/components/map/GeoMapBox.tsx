"use client"
import { useEffect, useRef, useState } from "react"
import { MapPinIcon, NavigationIcon } from "lucide-react"
import "mapbox-gl/dist/mapbox-gl.css"
import { isValidGPS, getMapCenter, type GPSCoordinates } from "@/lib/gps-utils"

interface GeoMapBoxProps {
  geometry: any | null // GeoJSON Feature or FeatureCollection
  gps: GPSCoordinates
  address?: string | null // Address for fallback geocoding
  height?: number
}

export function GeoMapBox({ geometry, gps, address, height = 340 }: GeoMapBoxProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [mapboxgl, setMapboxgl] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geocodedCenter, setGeocodedCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false)

  useEffect(() => {
    const loadMapbox = async () => {
      try {
        const mapboxModule = await import("mapbox-gl")
        const mapboxgl = (mapboxModule as any).default || mapboxModule
        setMapboxgl(mapboxgl)
        setIsLoading(false)
      } catch (err) {
        console.error("Failed to load Mapbox GL:", err)
        setError("Failed to load map library")
        setIsLoading(false)
      }
    }

    loadMapbox()
  }, [])

  // Handle geocoding when GPS is invalid but address is available
  useEffect(() => {
    const handleGeocoding = async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

      // Reset geocoded center when inputs change
      setGeocodedCenter(null)

      // Only geocode if GPS is invalid and we have an address and token
      if (!isValidGPS(gps) && address && token) {
        setIsGeocodingAddress(true)
        try {
          const center = await getMapCenter(gps, address, token)
          if (center) {
            setGeocodedCenter(center)
          }
        } catch (error) {
          console.error("Error getting map center:", error)
        } finally {
          setIsGeocodingAddress(false)
        }
      }
    }

    handleGeocoding()
  }, [gps, address])

  useEffect(() => {
    if (!mapboxgl || !mapContainer.current || map.current) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    console.log('Mapbox token available:', !!token, 'Token prefix:', token?.substring(0, 10))

    if (!token) {
      setError("Mapbox token not configured")
      return
    }

    mapboxgl.accessToken = token

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-98.5795, 39.8283], // Center of US
        zoom: 4,
      })

      map.current.on("load", () => {
        addGeometryToMap()
        addMarkersToMap()
        fitMapBounds()
      })

      map.current.on("error", (e: any) => {
        console.error("Mapbox error:", e)
        setError("Map failed to load")
      })
    } catch (err) {
      console.error("Failed to initialize map:", err)
      setError("Failed to initialize map")
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [mapboxgl, geometry, gps, geocodedCenter])

  const addGeometryToMap = () => {
    if (!map.current || !geometry) return

    try {
      const geojson =
        geometry.type === "FeatureCollection"
          ? geometry
          : {
              type: "FeatureCollection",
              features: [{ type: "Feature", geometry, properties: {} }],
            }

      map.current.addSource("geometry", {
        type: "geojson",
        data: geojson,
      })

      // Add fill layer for polygons
      map.current.addLayer({
        id: "geometry-fill",
        type: "fill",
        source: "geometry",
        filter: ["==", "$type", "Polygon"],
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.3,
        },
      })

      // Add line layer for polygons and linestrings
      map.current.addLayer({
        id: "geometry-line",
        type: "line",
        source: "geometry",
        filter: ["in", "$type", "Polygon", "LineString"],
        paint: {
          "line-color": "#3b82f6",
          "line-width": 2,
        },
      })

      // Add circle layer for points
      map.current.addLayer({
        id: "geometry-point",
        type: "circle",
        source: "geometry",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-color": "#3b82f6",
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      })
    } catch (err) {
      console.error("Failed to add geometry to map:", err)
    }
  }

  const addMarkersToMap = () => {
    if (!map.current) return

    try {
      // Remove existing markers if any
      if (map.current.getLayer("gps-point")) {
        map.current.removeLayer("gps-point")
      }
      if (map.current.getSource("gps")) {
        map.current.removeSource("gps")
      }
      if (map.current.getLayer("address-point")) {
        map.current.removeLayer("address-point")
      }
      if (map.current.getSource("address")) {
        map.current.removeSource("address")
      }

      // Add valid GPS marker
      if (isValidGPS(gps)) {
        map.current.addSource("gps", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [gps.lng, gps.lat],
                },
                properties: { type: "gps" },
              },
            ],
          },
        })

        map.current.addLayer({
          id: "gps-point",
          type: "circle",
          source: "gps",
          paint: {
            "circle-color": "#ef4444",
            "circle-radius": 6,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        })
      }
      // Add geocoded address marker when GPS is invalid but address was found
      else if (geocodedCenter) {
        map.current.addSource("address", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [geocodedCenter.lng, geocodedCenter.lat],
                },
                properties: { type: "address" },
              },
            ],
          },
        })

        map.current.addLayer({
          id: "address-point",
          type: "circle",
          source: "address",
          paint: {
            "circle-color": "#3b82f6",
            "circle-radius": 8,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        })
      }
    } catch (err) {
      console.error("Failed to add markers to map:", err)
    }
  }

  const fitMapBounds = () => {
    if (!map.current) return

    try {
      const bounds = new mapboxgl.LngLatBounds()
      let hasPoints = false

      if (geometry) {
        const coords =
          geometry.type === "FeatureCollection"
            ? geometry.features[0]?.geometry?.coordinates
            : geometry.geometry?.coordinates || geometry.coordinates

        if (coords) {
          const geomType =
            geometry.type === "FeatureCollection"
              ? geometry.features[0]?.geometry?.type
              : geometry.geometry?.type || geometry.type

          if (geomType === "Point") {
            bounds.extend([coords[0], coords[1]])
            hasPoints = true
          } else if (geomType === "Polygon" && coords[0]) {
            coords[0].forEach((coord: number[]) => bounds.extend(coord))
            hasPoints = true
          } else if (geomType === "LineString") {
            coords.forEach((coord: number[]) => bounds.extend(coord))
            hasPoints = true
          }
        }
      }

      // Include valid GPS coordinates
      if (isValidGPS(gps)) {
        bounds.extend([gps.lng, gps.lat])
        hasPoints = true
      }
      // Include geocoded address center
      else if (geocodedCenter) {
        bounds.extend([geocodedCenter.lng, geocodedCenter.lat])
        hasPoints = true
      }

      if (hasPoints) {
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 16 })
      }
    } catch (err) {
      console.error("Failed to fit map bounds:", err)
    }
  }

  const getGeometryInfo = () => {
    if (!geometry) return null

    const geomType =
      geometry.type === "FeatureCollection"
        ? geometry.features[0]?.geometry?.type
        : geometry.geometry?.type || geometry.type

    const coords =
      geometry.type === "FeatureCollection"
        ? geometry.features[0]?.geometry?.coordinates
        : geometry.geometry?.coordinates || geometry.coordinates

    if (geomType === "Point") {
      return `Point: ${coords[1]?.toFixed(6)}, ${coords[0]?.toFixed(6)}`
    } else if (geomType === "Polygon") {
      const pointCount = coords[0]?.length || 0
      return `Polygon: ${pointCount} boundary points`
    } else if (geomType === "LineString") {
      const pointCount = coords.length || 0
      return `Line: ${pointCount} points`
    }

    return "Complex geometry"
  }

  if (isLoading || isGeocodingAddress) {
    return (
      <div style={{ height: `${height}px` }} className="rounded-lg border bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm text-muted-foreground">
            {isGeocodingAddress ? "Geocoding address..." : "Loading map..."}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ height: `${height}px` }} className="rounded-lg border bg-muted/30 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <MapPinIcon className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-base">Map Unavailable</h3>
              <div className="text-sm text-muted-foreground">{error}</div>
              {geometry && (
                <div className="text-sm text-muted-foreground mt-4">
                  <div className="font-medium">Location Data:</div>
                  <div>{getGeometryInfo()}</div>
                </div>
              )}
              {/* Show GPS status */}
              {isValidGPS(gps) && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
                  <NavigationIcon className="w-4 h-4" />
                  <span>
                    Valid GPS: {gps.lat!.toFixed(6)}, {gps.lng!.toFixed(6)}
                  </span>
                </div>
              )}
              {!isValidGPS(gps) && gps.lat !== null && gps.lng !== null && (
                <div className="flex items-center justify-center gap-2 text-sm text-red-600 mt-2">
                  <NavigationIcon className="w-4 h-4" />
                  <span>
                    Invalid GPS: {gps.lat}, {gps.lng}
                  </span>
                </div>
              )}
              {geocodedCenter && (
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mt-2">
                  <MapPinIcon className="w-4 h-4" />
                  <span>
                    Address Location: {geocodedCenter.lat.toFixed(6)}, {geocodedCenter.lng.toFixed(6)}
                  </span>
                </div>
              )}
              {!isValidGPS(gps) && !geocodedCenter && address && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
                  <MapPinIcon className="w-4 h-4" />
                  <span>
                    Address not found: {address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: `${height}px` }} className="rounded-lg border overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}
