"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormFieldWrapper } from "../FormFieldWrapper"

export function AdditionalDetailsSection() {
  const { register } = useFormContext()

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Additional information that may be helpful for processing this ticket.
      </p>

      <FormFieldWrapper
        name="additional.notes"
        label="Additional Notes"
        helpText="Any other relevant information about this excavation project"
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
      >
        <Input
          {...register("additional.contact_method")}
          placeholder="Phone, email, etc."
        />
      </FormFieldWrapper>
    </div>
  )
}