"use client"
import { useEffect, useRef, useState } from "react"
import { MapPinIcon, NavigationIcon } from "lucide-react"
import "mapbox-gl/dist/mapbox-gl.css"

interface GeoMapBoxProps {
  geometry: any | null // GeoJSON Feature or FeatureCollection
  gps: { lat: number | null; lng: number | null }
  height?: number
}

export function GeoMapBox({ geometry, gps, height = 340 }: GeoMapBoxProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [mapboxgl, setMapboxgl] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        addGPSToMap()
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
  }, [mapboxgl, geometry, gps])

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

  const addGPSToMap = () => {
    if (!map.current || !gps.lat || !gps.lng) return

    try {
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
              properties: {},
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
    } catch (err) {
      console.error("Failed to add GPS to map:", err)
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

      if (gps.lat && gps.lng) {
        bounds.extend([gps.lng, gps.lat])
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

  if (isLoading) {
    return (
      <div style={{ height: `${height}px` }} className="rounded-lg border bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm text-muted-foreground">Loading map...</div>
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
              {gps.lat && gps.lng && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
                  <NavigationIcon className="w-4 h-4" />
                  <span>
                    GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
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
