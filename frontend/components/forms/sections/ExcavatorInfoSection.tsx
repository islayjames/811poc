"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { FormFieldWrapper } from "../FormFieldWrapper"

export function ExcavatorInfoSection() {
  const { register } = useFormContext()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormFieldWrapper
        name="excavator.company"
        label="Company Name"
        required
        helpText="Name of the excavating company or organization"
        examples={[
          "ABC Construction Inc.",
          "Texas Utility Services LLC",
          "Metro Excavation Company"
        ]}
      >
        <Input
          {...register("excavator.company")}
          placeholder="Enter company name"
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="excavator.contact_name"
        label="Contact Name"
        required
        helpText="Primary contact person for this excavation project"
        examples={[
          "John Smith",
          "Maria Rodriguez",
          "David Johnson"
        ]}
      >
        <Input
          {...register("excavator.contact_name")}
          placeholder="Enter contact name"
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="excavator.phone"
        label="Phone Number"
        required
        helpText="Primary phone number in format (xxx) xxx-xxxx"
        examples={[
          "(512) 555-0123",
          "(214) 555-9876",
          "(713) 555-4567"
        ]}
      >
        <Input
          {...register("excavator.phone")}
          placeholder="(555) 123-4567"
          type="tel"
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="excavator.email"
        label="Email Address"
        helpText="Email address for notifications and updates (optional)"
        examples={[
          "john.smith@company.com",
          "excavation@contractor.com",
          "permits@construction.net"
        ]}
      >
        <Input
          {...register("excavator.email")}
          placeholder="Enter email address"
          type="email"
        />
      </FormFieldWrapper>
    </div>
  )
}