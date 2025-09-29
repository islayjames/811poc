"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { FormFieldWrapper } from "../FormFieldWrapper"

export function WorkDetailsSection() {
  const { register, setValue, watch } = useFormContext()

  const isTrenchless = watch("work.is_trenchless")
  const isBlasting = watch("work.is_blasting")

  return (
    <div className="space-y-6">
      <FormFieldWrapper
        name="work.work_for"
        label="Work For"
        helpText="Who is this work being performed for?"
      >
        <Input
          {...register("work.work_for")}
          placeholder="Enter client or organization"
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="work.type_of_work"
        label="Work Description"
        required
        helpText="Detailed description of the excavation or construction work to be performed"
      >
        <Textarea
          {...register("work.type_of_work")}
          placeholder="Describe the type and scope of work: e.g., Install 6-inch water line from Main St to Oak Ave, approximately 500 feet, depth of 3-4 feet..."
          rows={3}
        />
      </FormFieldWrapper>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormFieldWrapper
          name="work.depth_inches"
          label="Depth (inches)"
          helpText="Maximum depth of excavation in inches"
        >
          <Input
            {...register("work.depth_inches", {
              valueAsNumber: true,
              setValueAs: (value) => value === "" ? null : Number(value)
            })}
            placeholder="24"
            type="number"
            min="0"
          />
        </FormFieldWrapper>

        <FormFieldWrapper
          name="work.duration_days"
          label="Duration (days)"
          helpText="Expected duration of work in days"
        >
          <Input
            {...register("work.duration_days", {
              valueAsNumber: true,
              setValueAs: (value) => value === "" ? null : Number(value)
            })}
            placeholder="5"
            type="number"
            min="1"
          />
        </FormFieldWrapper>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium">Work Characteristics</h4>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="work.is_trenchless"
              checked={isTrenchless}
              onCheckedChange={(checked) => setValue("work.is_trenchless", checked)}
            />
            <label
              htmlFor="work.is_trenchless"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Trenchless excavation
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="work.is_blasting"
              checked={isBlasting}
              onCheckedChange={(checked) => setValue("work.is_blasting", checked)}
            />
            <label
              htmlFor="work.is_blasting"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Blasting/explosives will be used
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}