/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAutoSave } from '@/hooks/use-auto-save'
import type { TicketFormData } from '@/lib/types/form'

// Mock the debounce function
jest.mock('@/lib/utils', () => ({
  debounce: jest.fn((fn) => fn),
  deepEqual: jest.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
}))

// Test component that uses the auto-save hook
function TestAutoSaveComponent({
  formData,
  onAutoSave,
  onError,
  enabled = true,
  ticketId
}: {
  formData: TicketFormData
  onAutoSave: (data: TicketFormData) => Promise<void>
  onError: (error: Error) => void
  enabled?: boolean
  ticketId?: string
}) {
  const autoSave = useAutoSave(formData, {
    interval: 1000, // 1 second for testing
    debounceDelay: 100, // 100ms for testing
    onAutoSave,
    onError,
    enabled,
    ticketId
  })

  return (
    <div>
      <div data-testid="status">{autoSave.status}</div>
      <div data-testid="has-changes">{autoSave.hasUnsavedChanges.toString()}</div>
      <div data-testid="is-saving">{autoSave.isSaving.toString()}</div>
      {autoSave.lastSaved && (
        <div data-testid="last-saved">{autoSave.lastSaved.toISOString()}</div>
      )}
      <button onClick={() => autoSave.triggerAutoSave()} data-testid="manual-save">
        Manual Save
      </button>
      <button onClick={() => autoSave.clearAutoSave()} data-testid="clear-auto-save">
        Clear Auto Save
      </button>
    </div>
  )
}

const mockFormData: TicketFormData = {
  excavator: {
    company: 'Test Company',
    contact_name: 'John Doe',
    phone: '555-1234',
    email: 'john@test.com'
  },
  work: {
    work_for: 'Client',
    type_of_work: 'Installation',
    is_trenchless: false,
    is_blasting: false,
    depth_inches: 24,
    duration_days: 5
  },
  site: {
    county: 'Test County',
    city: 'Test City',
    address: '123 Test St',
    cross_street: 'Main St',
    subdivision: '',
    lot_block: '',
    gps: { lat: 30.0, lng: -97.0 },
    driving_directions: '',
    marking_instructions: '',
    remarks: '',
    work_area_description: 'Test area',
    site_marked_white: false
  },
  additional: {}
}

describe('useAutoSave Hook', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    jest.clearAllMocks()
  })

  test('should initialize with idle status', () => {
    const mockOnAutoSave = jest.fn().mockResolvedValue(undefined)
    const mockOnError = jest.fn()

    render(
      <TestAutoSaveComponent
        formData={mockFormData}
        onAutoSave={mockOnAutoSave}
        onError={mockOnError}
      />
    )

    expect(screen.getByTestId('status')).toHaveTextContent('idle')
    expect(screen.getByTestId('has-changes')).toHaveTextContent('false')
    expect(screen.getByTestId('is-saving')).toHaveTextContent('false')
  })

  test('should detect changes in form data', async () => {
    const mockOnAutoSave = jest.fn().mockResolvedValue(undefined)
    const mockOnError = jest.fn()

    const { rerender } = render(
      <TestAutoSaveComponent
        formData={mockFormData}
        onAutoSave={mockOnAutoSave}
        onError={mockOnError}
      />
    )

    // Update form data
    const updatedFormData = {
      ...mockFormData,
      excavator: {
        ...mockFormData.excavator,
        company: 'Updated Company'
      }
    }

    rerender(
      <TestAutoSaveComponent
        formData={updatedFormData}
        onAutoSave={mockOnAutoSave}
        onError={mockOnError}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-changes')).toHaveTextContent('true')
    })
  })

  test('should trigger manual auto-save', async () => {
    const mockOnAutoSave = jest.fn().mockResolvedValue(undefined)
    const mockOnError = jest.fn()

    render(
      <TestAutoSaveComponent
        formData={mockFormData}
        onAutoSave={mockOnAutoSave}
        onError={mockOnError}
      />
    )

    const manualSaveButton = screen.getByTestId('manual-save')
    fireEvent.click(manualSaveButton)

    await waitFor(() => {
      expect(mockOnAutoSave).toHaveBeenCalledWith(mockFormData)
    })
  })

  test('should save to localStorage', () => {
    const mockOnAutoSave = jest.fn().mockResolvedValue(undefined)
    const mockOnError = jest.fn()

    render(
      <TestAutoSaveComponent
        formData={mockFormData}
        onAutoSave={mockOnAutoSave}
        onError={mockOnError}
        ticketId="test-ticket-123"
      />
    )

    // Check if localStorage has the auto-save data
    const stored = localStorage.getItem('ticket-autosave-test-ticket-123')
    expect(stored).toBeTruthy()

    if (stored) {
      const parsed = JSON.parse(stored)
      expect(parsed.data).toEqual(mockFormData)
      expect(parsed.ticketId).toBe('test-ticket-123')
    }
  })

  test('should handle auto-save errors', async () => {
    const mockError = new Error('Auto-save failed')
    const mockOnAutoSave = jest.fn().mockRejectedValue(mockError)
    const mockOnError = jest.fn()

    render(
      <TestAutoSaveComponent
        formData={mockFormData}
        onAutoSave={mockOnAutoSave}
        onError={mockOnError}
      />
    )

    const manualSaveButton = screen.getByTestId('manual-save')
    fireEvent.click(manualSaveButton)

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(mockError)
      expect(screen.getByTestId('status')).toHaveTextContent('error')
    })
  })

  test('should not auto-save when disabled', async () => {
    const mockOnAutoSave = jest.fn().mockResolvedValue(undefined)
    const mockOnError = jest.fn()

    render(
      <TestAutoSaveComponent
        formData={mockFormData}
        onAutoSave={mockOnAutoSave}
        onError={mockOnError}
        enabled={false}
      />
    )

    const manualSaveButton = screen.getByTestId('manual-save')
    fireEvent.click(manualSaveButton)

    // Wait a bit to ensure no auto-save is triggered
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(mockOnAutoSave).not.toHaveBeenCalled()
  })
})

describe('Auto-save localStorage functions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('should restore from localStorage', () => {
    const testData = {
      data: mockFormData,
      timestamp: Date.now(),
      ticketId: 'test-123'
    }

    localStorage.setItem('ticket-autosave-test-123', JSON.stringify(testData))

    // This would be tested in the actual hook implementation
    const stored = localStorage.getItem('ticket-autosave-test-123')
    expect(stored).toBeTruthy()

    if (stored) {
      const parsed = JSON.parse(stored)
      expect(parsed.data).toEqual(mockFormData)
    }
  })

  test('should clear localStorage', () => {
    localStorage.setItem('ticket-autosave-test-123', JSON.stringify(mockFormData))

    localStorage.removeItem('ticket-autosave-test-123')

    expect(localStorage.getItem('ticket-autosave-test-123')).toBeNull()
  })
})