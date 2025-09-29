// Form-specific types for the Texas811 POC ticket creation and editing

export interface ExcavatorInfo {
  company: string
  contact_name: string
  phone: string
  email?: string
}

export interface WorkDetails {
  work_for?: string
  type_of_work: string // This now contains the full work description
  is_trenchless: boolean
  is_blasting: boolean
  depth_inches?: number | null
  duration_days?: number | null
}

export interface SiteInfo {
  county: string
  city: string
  address?: string
  cross_street?: string
  subdivision?: string
  lot_block?: string
  gps: {
    lat?: number | null
    lng?: number | null
  }
  driving_directions?: string
  marking_instructions?: string
  remarks?: string
  work_area_description: string
  site_marked_white: boolean
}

export interface AdditionalDetails {
  notes?: string
  reference_number?: string
  contact_method?: string
  [key: string]: any // Allow for future extensibility
}

export interface TicketFormData {
  excavator: ExcavatorInfo
  work: WorkDetails
  site: SiteInfo
  additional?: AdditionalDetails
}

export interface ValidationError {
  field?: string
  message: string
  code?: string
}

export interface TicketFormProps {
  mode: 'create' | 'edit'
  ticketId?: string
  initialData?: Partial<TicketFormData>
  onSave: (data: TicketFormData, options?: { isDraft?: boolean }) => Promise<void>
  onCancel: () => void
  validationErrors?: ValidationError[]
  isSubmitting?: boolean
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
}

// API response types
export interface CreateTicketResponse {
  ticket_id: string
  status: string
  validation_gaps?: ValidationError[]
  created_at: string
}

export interface UpdateTicketResponse {
  ticket_id: string
  status: string
  validation_gaps?: ValidationError[]
  updated_at: string
}

export interface ValidationResult {
  is_valid: boolean
  gaps: ValidationError[]
  warnings?: string[]
  completion_percentage?: number
}