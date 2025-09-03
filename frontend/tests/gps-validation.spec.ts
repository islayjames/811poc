import { test, expect } from '@playwright/test'
import { isValidGPS, geocodeAddress } from '../lib/gps-utils'

test.describe('GPS Validation Utils', () => {
  test.describe('isValidGPS', () => {
    test('should return false for null coordinates', async () => {
      expect(isValidGPS({ lat: null, lng: null })).toBe(false)
      expect(isValidGPS({ lat: 40.7128, lng: null })).toBe(false)
      expect(isValidGPS({ lat: null, lng: -74.0060 })).toBe(false)
    })

    test('should return false for invalid latitude', async () => {
      expect(isValidGPS({ lat: 91, lng: -74.0060 })).toBe(false)  // lat > 90
      expect(isValidGPS({ lat: -91, lng: -74.0060 })).toBe(false) // lat < -90
      expect(isValidGPS({ lat: 2025, lng: -74.0060 })).toBe(false) // clearly invalid lat like in the issue
    })

    test('should return false for invalid longitude', async () => {
      expect(isValidGPS({ lat: 40.7128, lng: 181 })).toBe(false)  // lng > 180
      expect(isValidGPS({ lat: 40.7128, lng: -181 })).toBe(false) // lng < -180
      expect(isValidGPS({ lat: 1.0, lng: 2025 })).toBe(false)     // clearly invalid lng like in the issue
    })

    test('should return true for valid coordinates', async () => {
      expect(isValidGPS({ lat: 40.7128, lng: -74.0060 })).toBe(true)  // NYC
      expect(isValidGPS({ lat: 29.7604, lng: -95.3698 })).toBe(true)  // Houston
      expect(isValidGPS({ lat: 0, lng: 0 })).toBe(true)              // Equator/Prime Meridian
      expect(isValidGPS({ lat: 90, lng: 180 })).toBe(true)           // Boundaries
      expect(isValidGPS({ lat: -90, lng: -180 })).toBe(true)         // Boundaries
    })
  })

  test.describe('geocodeAddress', () => {
    // Note: These tests would require a real Mapbox token to run properly
    // For actual testing, we'd want to mock the fetch calls

    test('should return null for empty address', async () => {
      const result = await geocodeAddress('', 'fake-token')
      expect(result).toBe(null)
    })

    test('should return null for empty token', async () => {
      const result = await geocodeAddress('123 Main St', '')
      expect(result).toBe(null)
    })

    test('should handle fetch errors gracefully', async () => {
      // This will fail because 'fake-token' is not valid, but should not throw
      const result = await geocodeAddress('123 Main St', 'fake-token')
      expect(result).toBe(null)
    })
  })
})
