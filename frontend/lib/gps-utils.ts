/**
 * GPS validation and geocoding utilities
 */

export interface GPSCoordinates {
  lat: number | null
  lng: number | null
}

export interface ValidGPSCoordinates {
  lat: number
  lng: number
}

export interface GeocodeResult {
  coordinates: ValidGPSCoordinates
  center: ValidGPSCoordinates
  bbox?: [number, number, number, number]
  place_name: string
}

/**
 * Validates if GPS coordinates are within valid ranges
 * @param gps GPS coordinates to validate
 * @returns true if GPS coordinates are valid, false otherwise
 */
export function isValidGPS(gps: GPSCoordinates): gps is ValidGPSCoordinates {
  if (gps.lat === null || gps.lng === null) {
    return false
  }

  // Latitude must be between -90 and 90
  if (gps.lat < -90 || gps.lat > 90) {
    return false
  }

  // Longitude must be between -180 and 180
  if (gps.lng < -180 || gps.lng > 180) {
    return false
  }

  return true
}

/**
 * Geocodes an address using Mapbox Geocoding API
 * @param address Address to geocode
 * @param accessToken Mapbox access token
 * @returns Promise resolving to geocoding result or null if failed
 */
export async function geocodeAddress(
  address: string,
  accessToken: string
): Promise<GeocodeResult | null> {
  if (!address.trim() || !accessToken) {
    return null
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim())
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${accessToken}&limit=1&types=address,poi`

    const response = await fetch(url)

    if (!response.ok) {
      console.error('Geocoding API error:', response.status, response.statusText)
      return null
    }

    const data = await response.json()

    if (!data.features || data.features.length === 0) {
      console.warn('No geocoding results found for address:', address)
      return null
    }

    const feature = data.features[0]
    const [lng, lat] = feature.center

    if (!isValidGPS({ lat, lng })) {
      console.error('Invalid GPS coordinates from geocoding:', { lat, lng })
      return null
    }

    return {
      coordinates: { lat, lng },
      center: { lat, lng },
      bbox: feature.bbox,
      place_name: feature.place_name || address
    }
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

/**
 * Determines the best center point for map display
 * @param gps GPS coordinates from ticket data
 * @param address Address for fallback geocoding
 * @param accessToken Mapbox access token
 * @returns Promise resolving to center coordinates or null if no valid location found
 */
export async function getMapCenter(
  gps: GPSCoordinates,
  address: string | null,
  accessToken: string
): Promise<ValidGPSCoordinates | null> {
  // First try to use provided GPS coordinates if valid
  if (isValidGPS(gps)) {
    return gps
  }

  // Fallback to geocoding address if available
  if (address) {
    const geocodeResult = await geocodeAddress(address, accessToken)
    if (geocodeResult) {
      return geocodeResult.center
    }
  }

  return null
}
