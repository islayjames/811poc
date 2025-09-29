"use client"

import React from "react"
import { useFormContext } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { FormFieldWrapper } from "../FormFieldWrapper"
import { CollapsibleSection, useSectionStats } from "../CollapsibleSection"
import { useFormValidation } from "@/hooks/use-form-validation"

const OPTIONAL_LOCATION_FIELDS = [
  'site.subdivision',
  'site.lot_block',
  'site.driving_directions',
  'site.marking_instructions',
  'site.remarks'
]

export function LocationInfoSection() {
  const { register, setValue, watch } = useFormContext()
  const { fieldValidationState } = useFormValidation()
  const optionalSectionStats = useSectionStats(OPTIONAL_LOCATION_FIELDS, fieldValidationState)

  const siteMarkedWhite = watch("site.site_marked_white")

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormFieldWrapper
          name="site.county"
          label="County"
          required
          helpText="County where the work will be performed"
          examples={[
            "Travis County",
            "Harris County",
            "Dallas County"
          ]}
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
          examples={[
            "Austin",
            "Houston",
            "Dallas"
          ]}
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
        helpText="Street address of the work location (optional if GPS provided)"
        examples={[
          "123 Main Street",
          "456 Oak Avenue Unit B",
          "789 Cedar Lane"
        ]}
      >
        <Input
          {...register("site.address")}
          placeholder="Enter street address"
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        name="site.cross_street"
        label="Cross Street"
        helpText="Nearest cross street or intersection (optional)"
        examples={[
          "Near intersection of Main St and 1st Ave",
          "Between Oak St and Maple St",
          "At the corner of Cedar Ln and Pine Rd"
        ]}
      >
        <Input
          {...register("site.cross_street")}
          placeholder="Enter cross street"
        />
      </FormFieldWrapper>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormFieldWrapper
          name="site.gps.lat"
          label="GPS Latitude"
          helpText="GPS latitude coordinate (decimal degrees)"
          examples={[
            "30.2672 (Austin area)",
            "29.7604 (Houston area)",
            "32.7767 (Dallas area)"
          ]}
        >
          <Input
            {...register("site.gps.lat", {
              valueAsNumber: true,
              setValueAs: (value) => value === "" ? null : Number(value)
            })}
            placeholder="30.2672"
            type="number"
            step="any"
          />
        </FormFieldWrapper>

        <FormFieldWrapper
          name="site.gps.lng"
          label="GPS Longitude"
          helpText="GPS longitude coordinate (decimal degrees)"
          examples={[
            "-97.7431 (Austin area)",
            "-95.3698 (Houston area)",
            "-96.7970 (Dallas area)"
          ]}
        >
          <Input
            {...register("site.gps.lng", {
              valueAsNumber: true,
              setValueAs: (value) => value === "" ? null : Number(value)
            })}
            placeholder="-97.7431"
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
        examples={[
          "Front yard area between sidewalk and house, approximately 10x20 feet",
          "Alley behind house, parallel to back fence for 50 feet",
          "Parking strip along Main Street from driveway to property line"
        ]}
      >
        <Textarea
          {...register("site.work_area_description")}
          placeholder="Describe the specific area where excavation will occur..."
          rows={3}
        />
      </FormFieldWrapper>

      {/* Optional Location Details */}
      <CollapsibleSection
        title="Additional Location Details"
        description="Optional information to help locate and access the work site"
        isOptional={true}
        completionStatus={optionalSectionStats.completionStatus}
        fieldCount={optionalSectionStats.fieldCount}
        completedFields={optionalSectionStats.completedFields}
        errorCount={optionalSectionStats.errorCount}
        defaultOpen={false}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormFieldWrapper
              name="site.subdivision"
              label="Subdivision"
              helpText="Subdivision or development name"
              examples={[
                "Westfield Estates",
                "Oak Grove Subdivision",
                "Cedar Hills Phase 2"
              ]}
            >
              <Input
                {...register("site.subdivision")}
                placeholder="Enter subdivision name"
              />
            </FormFieldWrapper>

            <FormFieldWrapper
              name="site.lot_block"
              label="Lot/Block"
              helpText="Lot and block number if applicable"
              examples={[
                "Lot 5, Block 12",
                "Lot 123",
                "Block A, Lot 45"
              ]}
            >
              <Input
                {...register("site.lot_block")}
                placeholder="Lot 5, Block 12"
              />
            </FormFieldWrapper>
          </div>

          <FormFieldWrapper
            name="site.driving_directions"
            label="Driving Directions"
            helpText="Specific directions to help locate the work site"
            examples={[
              "Enter through main gate, follow road to building 3",
              "Use north entrance, work site behind the main building",
              "Access via service road on east side of property"
            ]}
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
            examples={[
              "Please mark entire front yard area",
              "Focus marking on driveway and adjacent grass area",
              "Mark utilities in both front and back yard areas"
            ]}
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
            examples={[
              "Site has steep slope, use caution when marking",
              "Property has aggressive dogs, please contact owner first",
              "Work area recently sodded, please be careful with flags"
            ]}
          >
            <Textarea
              {...register("site.remarks")}
              placeholder="Additional comments or special considerations..."
              rows={2}
            />
          </FormFieldWrapper>
        </div>
      </CollapsibleSection>

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