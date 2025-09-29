"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { FormFieldWrapper } from "../FormFieldWrapper"

export function LocationInfoSection() {
  const { register, setValue, watch } = useFormContext()

  const siteMarkedWhite = watch("site.site_marked_white")

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormFieldWrapper
          name="site.county"
          label="County"
          required
          helpText="County where the work will be performed"
        >
          <Input
            {...register("site.county")}
            placeholder="Enter county name"
          />
        </FormFieldWrapper>

        <FormFieldWrapper
          name="site.city"
          label="City"
          required
          helpText="City where the work will be performed"
        >
          <Input
            {...register("site.city")}
            placeholder="Enter city name"
          />
        </FormFieldWrapper>
      </div>

      <FormFieldWrapper
        name="site.address"
        label="Street Address"
        helpText="Street address of the work location"
      >
        <Input
          {...register("site.address")}
          placeholder="Enter street address"
        />
      </FormFieldWrapper>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormFieldWrapper
          name="site.cross_street"
          label="Cross Street"
          helpText="Nearest cross street or intersection"
        >
          <Input
            {...register("site.cross_street")}
            placeholder="Enter cross street"
          />
        </FormFieldWrapper>

        <FormFieldWrapper
          name="site.subdivision"
          label="Subdivision"
          helpText="Subdivision or development name"
        >
          <Input
            {...register("site.subdivision")}
            placeholder="Enter subdivision name"
          />
        </FormFieldWrapper>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormFieldWrapper
          name="site.lot_block"
          label="Lot/Block"
          helpText="Lot and block number if applicable"
        >
          <Input
            {...register("site.lot_block")}
            placeholder="Lot 5, Block 12"
          />
        </FormFieldWrapper>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormFieldWrapper
          name="site.gps.lat"
          label="GPS Latitude"
          helpText="GPS latitude coordinate (decimal degrees)"
        >
          <Input
            {...register("site.gps.lat", {
              valueAsNumber: true,
              setValueAs: (value) => value === "" ? null : Number(value)
            })}
            placeholder="32.7767"
            type="number"
            step="any"
          />
        </FormFieldWrapper>

        <FormFieldWrapper
          name="site.gps.lng"
          label="GPS Longitude"
          helpText="GPS longitude coordinate (decimal degrees)"
        >
          <Input
            {...register("site.gps.lng", {
              valueAsNumber: true,
              setValueAs: (value) => value === "" ? null : Number(value)
            })}
            placeholder="-96.7970"
            type="number"
            step="any"
          />
        </FormFieldWrapper>
      </div>

      <FormFieldWrapper
        name="site.work_area_description"
        label="Work Area Description"
        required
        helpText="Detailed description of the work area and excavation site"
      >
        <Textarea
          {...register("site.work_area_description")}
          placeholder="Describe the specific area where excavation will occur..."
          rows={3}
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="site.driving_directions"
        label="Driving Directions"
        helpText="Specific directions to help locate the work site"
      >
        <Textarea
          {...register("site.driving_directions")}
          placeholder="Provide turn-by-turn directions to the work site..."
          rows={2}
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="site.marking_instructions"
        label="Marking Instructions"
        helpText="Special instructions for utility marking"
      >
        <Textarea
          {...register("site.marking_instructions")}
          placeholder="Any special instructions for marking utilities..."
          rows={2}
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="site.remarks"
        label="Additional Remarks"
        helpText="Any additional information about the work site"
      >
        <Textarea
          {...register("site.remarks")}
          placeholder="Additional comments or special considerations..."
          rows={2}
        />
      </FormFieldWrapper>

      <div className="space-y-4">
        <h4 className="text-sm font-medium">Site Preparation</h4>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="site.site_marked_white"
            checked={siteMarkedWhite}
            onCheckedChange={(checked) => setValue("site.site_marked_white", checked)}
          />
          <label
            htmlFor="site.site_marked_white"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Site has been marked with white paint/flags
          </label>
        </div>
      </div>
    </div>
  )
}