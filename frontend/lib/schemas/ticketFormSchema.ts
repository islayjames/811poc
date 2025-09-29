import { z } from "zod"

// Custom validation patterns for Texas811 requirements
const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Custom validators
const phoneValidator = z.string()
  .min(1, "Phone number is required")
  .regex(phoneRegex, "Phone number must be in format (xxx) xxx-xxxx")

const emailValidator = z.string()
  .email("Invalid email address")
  .optional()
  .or(z.literal(""))

const requiredStringValidator = (fieldName: string, minLength = 1) =>
  z.string()
    .min(minLength, `${fieldName} is required`)
    .trim()

const optionalStringValidator = () =>
  z.string()
    .optional()
    .or(z.literal(""))

const gpsCoordinateValidator = (coordType: "latitude" | "longitude") =>
  z.number()
    .refine((val) => {
      if (coordType === "latitude") {
        return val >= -90 && val <= 90
      } else {
        return val >= -180 && val <= 180
      }
    }, `Invalid ${coordType}`)
    .nullable()
    .optional()

// Excavator Information Schema
const excavatorSchema = z.object({
  company: requiredStringValidator("Company name", 2),
  contact_name: requiredStringValidator("Contact name", 2),
  phone: phoneValidator,
  email: emailValidator
})

// Work Details Schema
const workDetailsSchema = z.object({
  work_for: optionalStringValidator(),
  type_of_work: requiredStringValidator("Type of work", 10), // Combined type and description
  is_trenchless: z.boolean().default(false),
  is_blasting: z.boolean().default(false),
  depth_inches: z.number()
    .min(0, "Depth must be positive")
    .max(1000, "Depth seems unusually large")
    .nullable()
    .optional(),
  duration_days: z.number()
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration cannot exceed 365 days")
    .nullable()
    .optional()
})

// Site Information Schema
const siteInfoSchema = z.object({
  county: requiredStringValidator("County", 2),
  city: requiredStringValidator("City", 2),
  address: optionalStringValidator(),
  cross_street: optionalStringValidator(),
  subdivision: optionalStringValidator(),
  lot_block: optionalStringValidator(),
  gps: z.object({
    lat: gpsCoordinateValidator("latitude"),
    lng: gpsCoordinateValidator("longitude")
  }),
  driving_directions: optionalStringValidator(),
  marking_instructions: optionalStringValidator(),
  remarks: optionalStringValidator(),
  work_area_description: requiredStringValidator("Work area description", 10),
  site_marked_white: z.boolean().default(false)
}).refine((data) => {
  // Texas811 requirement: Must have either address OR GPS coordinates
  const hasAddress = data.address && data.address.trim().length > 0
  const hasGPS = data.gps.lat !== null && data.gps.lng !== null
  return hasAddress || hasGPS
}, {
  message: "Either street address or GPS coordinates are required",
  path: ["address"] // Show error on address field
}).refine((data) => {
  // If GPS coordinates are provided, validate they're both present
  const hasPartialGPS = (data.gps.lat !== null) !== (data.gps.lng !== null)
  return !hasPartialGPS
}, {
  message: "Both latitude and longitude are required if providing GPS coordinates",
  path: ["gps"]
})

// Additional Details Schema
const additionalDetailsSchema = z.object({
  notes: optionalStringValidator(),
  reference_number: optionalStringValidator(),
  contact_method: optionalStringValidator()
})

// Main Form Schema
export const ticketFormSchema = z.object({
  excavator: excavatorSchema,
  work: workDetailsSchema,
  site: siteInfoSchema,
  additional: additionalDetailsSchema.optional()
}).refine((data) => {
  // Cross-field validation: If blasting is true, require additional safety notes
  if (data.work.is_blasting && (!data.additional?.notes || data.additional.notes.trim().length < 10)) {
    return false
  }
  return true
}, {
  message: "Additional safety notes are required when blasting/explosives are used",
  path: ["additional", "notes"]
})

// Progressive validation schemas for real-time feedback
export const excavatorValidationSchema = excavatorSchema
export const workValidationSchema = workDetailsSchema
export const siteValidationSchema = siteInfoSchema
export const additionalValidationSchema = additionalDetailsSchema

// Field-level validation helpers
export const validateField = (fieldPath: string, value: any) => {
  try {
    const pathParts = fieldPath.split('.')
    let schema: any = ticketFormSchema

    // Navigate to the correct sub-schema
    for (const part of pathParts) {
      if (schema.shape && schema.shape[part]) {
        schema = schema.shape[part]
      }
    }

    schema.parse(value)
    return { isValid: true, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        error: error.errors[0]?.message || "Invalid value"
      }
    }
    return { isValid: false, error: "Validation error" }
  }
}

// Get validation completion percentage
export const getValidationCompletion = (data: Partial<any>) => {
  const requiredFields = [
    'excavator.company',
    'excavator.contact_name',
    'excavator.phone',
    'work.type_of_work',
    'site.county',
    'site.city',
    'site.work_area_description'
  ]

  const completedFields = requiredFields.filter(fieldPath => {
    const value = getNestedValue(data, fieldPath)
    return value && String(value).trim().length > 0
  })

  return Math.round((completedFields.length / requiredFields.length) * 100)
}

// Helper function to get nested object values
const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

// Export schema type
export type TicketFormSchemaType = z.infer<typeof ticketFormSchema>

// Validation error types
export interface FieldValidationResult {
  isValid: boolean
  error: string | null
}

export interface FormValidationResult {
  isValid: boolean
  errors: Record<string, string>
  completionPercentage: number
}