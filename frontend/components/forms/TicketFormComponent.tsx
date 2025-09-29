"use client"

import React from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Save, Send, Loader2 } from "lucide-react"
import { ExcavatorInfoSection } from "./sections/ExcavatorInfoSection"
import { WorkDetailsSection } from "./sections/WorkDetailsSection"
import { LocationInfoSection } from "./sections/LocationInfoSection"
import { AdditionalDetailsSection } from "./sections/AdditionalDetailsSection"
import { ticketFormSchema } from "@/lib/schemas/ticketFormSchema"
import type { TicketFormData, TicketFormProps, ValidationError } from "@/lib/types/form"

export function TicketFormComponent({
  mode,
  ticketId,
  initialData,
  onSave,
  onCancel,
  validationErrors = [],
  isSubmitting = false,
  autoSaveStatus = "idle"
}: TicketFormProps) {
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: initialData || {
      excavator: {
        company: "",
        contact_name: "",
        phone: "",
        email: ""
      },
      work: {
        work_for: "",
        type_of_work: "",
        is_trenchless: false,
        is_blasting: false,
        depth_inches: null,
        duration_days: null
      },
      site: {
        county: "",
        city: "",
        address: "",
        cross_street: "",
        subdivision: "",
        lot_block: "",
        gps: { lat: null, lng: null },
        driving_directions: "",
        marking_instructions: "",
        remarks: "",
        work_area_description: "",
        site_marked_white: false
      },
      additional: {}
    },
    mode: "onChange"
  })

  const { handleSubmit, formState: { isDirty, isValid }, watch } = form

  const onSubmit = async (data: TicketFormData) => {
    try {
      await onSave(data)
    } catch (error) {
      console.error("Form submission error:", error)
    }
  }

  const handleSaveDraft = () => {
    const currentData = form.getValues()
    onSave(currentData, { isDraft: true })
  }

  const getAutoSaveStatusText = () => {
    switch (autoSaveStatus) {
      case "saving":
        return "Saving..."
      case "saved":
        return "Draft saved"
      case "error":
        return "Save failed"
      default:
        return ""
    }
  }

  return (
    <FormProvider {...form}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === "create" ? "Create New Ticket" : "Edit Ticket"}
            </h1>
            <p className="text-muted-foreground">
              {mode === "create"
                ? "Create a new utility locate ticket for submission to Texas 811"
                : `Editing ticket ${ticketId}`}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {autoSaveStatus !== "idle" && (
              <div className="text-sm text-muted-foreground flex items-center">
                {autoSaveStatus === "saving" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {getAutoSaveStatusText()}
              </div>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validation Issues</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Excavator Information */}
          <Card>
            <CardHeader>
              <CardTitle>Excavator Information</CardTitle>
            </CardHeader>
            <CardContent>
              <ExcavatorInfoSection />
            </CardContent>
          </Card>

          {/* Work Details */}
          <Card>
            <CardHeader>
              <CardTitle>Work Details</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkDetailsSection />
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card>
            <CardHeader>
              <CardTitle>Location Information</CardTitle>
            </CardHeader>
            <CardContent>
              <LocationInfoSection />
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Details</CardTitle>
            </CardHeader>
            <CardContent>
              <AdditionalDetailsSection />
            </CardContent>
          </Card>

          {/* Form Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting || !isDirty}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isValid}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {mode === "create" ? "Create Ticket" : "Update Ticket"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </FormProvider>
  )
}