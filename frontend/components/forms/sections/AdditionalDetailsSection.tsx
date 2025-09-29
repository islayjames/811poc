"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormFieldWrapper } from "../FormFieldWrapper"
import { CollapsibleSection, useSectionStats } from "../CollapsibleSection"
import { useFormValidation } from "@/hooks/use-form-validation"

const ADDITIONAL_FIELDS = [
  'additional.notes',
  'additional.reference_number',
  'additional.contact_method'
]

export function AdditionalDetailsSection() {
  const { register } = useFormContext()
  const { fieldValidationState } = useFormValidation()
  const sectionStats = useSectionStats(ADDITIONAL_FIELDS, fieldValidationState)

  return (
    <CollapsibleSection
      title="Additional Details"
      description="Optional information that may be helpful for processing this ticket"
      isOptional={true}
      completionStatus={sectionStats.completionStatus}
      fieldCount={sectionStats.fieldCount}
      completedFields={sectionStats.completedFields}
      errorCount={sectionStats.errorCount}
      defaultOpen={false}
    >
      <div className="space-y-6">
        <FormFieldWrapper
          name="additional.notes"
          label="Additional Notes"
          helpText="Any other relevant information about this excavation project"
          examples={[
            "Special safety requirements or hazards",
            "Project timeline constraints",
            "Coordination with other contractors"
          ]}
        >
          <Textarea
            {...register("additional.notes")}
            placeholder="Enter any additional notes or special requirements..."
            rows={3}
          />
        </FormFieldWrapper>

        <FormFieldWrapper
          name="additional.reference_number"
          label="Reference Number"
          helpText="Internal reference or project number"
          examples={[
            "Work order #12345",
            "Project code ABC-2024",
            "Permit number P-2024-001"
          ]}
        >
          <Input
            {...register("additional.reference_number")}
            placeholder="Enter reference number"
          />
        </FormFieldWrapper>

        <FormFieldWrapper
          name="additional.contact_method"
          label="Preferred Contact Method"
          helpText="How would you prefer to be contacted about this ticket?"
          examples={[
            "Phone (business hours only)",
            "Email for all updates",
            "Text messages for urgent issues"
          ]}
        >
          <Input
            {...register("additional.contact_method")}
            placeholder="Phone, email, text, etc."
          />
        </FormFieldWrapper>
      </div>
    </CollapsibleSection>
  )
}