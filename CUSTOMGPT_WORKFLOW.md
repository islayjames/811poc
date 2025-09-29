# CustomGPT API Workflow for Texas 811 POC

> **Version:** 1.0  
> **Last Updated:** December 2024  
> **System:** Texas 811 POC Backend API  

## Overview

The Texas 811 POC is designed for seamless integration with CustomGPT to provide a conversational interface for PDF work order processing. This document outlines the complete API call sequence and workflow that CustomGPT follows to transform PDF data into submission-ready tickets.

## Authentication

All API calls require Bearer token authentication:

```http
Authorization: Bearer customgpt-integration-key
Content-Type: application/json
```

**Valid API Keys for POC:**
- `customgpt-integration-key` (for CustomGPT integration)
- `test-api-key-12345` (for testing)
- Any configured production API key

## Core API Workflow Sequence

### Phase 1: Initial Ticket Creation

**📄 Step 1: PDF Data Extraction (CustomGPT Internal)**
CustomGPT uses vision capabilities to extract fields from uploaded PDF work orders, then initiates the API workflow.

**🔗 Step 2: Create Draft Ticket**

```http
POST /tickets/create
```

**Request Body:**
```json
{
  "session_id": "customgpt-session-12345",
  "county": "Harris",
  "city": "Houston", 
  "address": "1500 Louisiana Street, Houston, TX 77002",
  "work_description": "Install fiber optic cable for telecommunications",
  "caller_name": "Mike Johnson",
  "caller_company": "Houston Telecom Services",
  "caller_phone": "(713) 555-0199"
}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-09-02T01:00:00Z",
  "request_id": "req_abc123",
  "ticket_id": "A1B2",
  "session_id": "customgpt-session-12345",
  "status": "draft",
  "county": "Harris",
  "city": "Houston",
  "address": "1500 Louisiana Street, Houston, TX 77002",
  "work_description": "Install fiber optic cable for telecommunications",
  "validation_gaps": [
    {
      "field_name": "cross_street",
      "severity": "recommended", 
      "message": "Cross street helps utilities locate work area precisely",
      "prompt_text": "What is the nearest cross street to 1500 Louisiana Street?"
    },
    {
      "field_name": "work_start_date",
      "severity": "required",
      "message": "Work start date is required for Texas 811 submission",
      "prompt_text": "When do you plan to start this work? (must be at least 2 business days from today)"
    }
  ],
  "next_prompt": "I need a few more details to complete your Texas 811 ticket. When do you plan to start this work? (must be at least 2 business days from today)",
  "lawful_start_date": "2025-09-05",
  "ticket_expires_date": "2025-09-16"
}
```

### Phase 2: Iterative Data Completion

**💬 Step 3: CustomGPT Conversation**
CustomGPT uses the `next_prompt` and `validation_gaps` to ask users targeted questions:

> "I need a few more details to complete your Texas 811 ticket. When do you plan to start this work? (must be at least 2 business days from today)"

**🔗 Step 4: Update Ticket (Repeated as needed)**

```http
POST /tickets/{ticket_id}/update
```

**Request Body:**
```json
{
  "work_start_date": "2025-09-07",
  "cross_street": "Prairie Street", 
  "caller_email": "mike.johnson@houstontelecom.com",
  "work_duration_days": 3,
  "excavator_company": "Houston Telecom Services"
}
```

**Response:**
```json
{
  "success": true,
  "ticket_id": "A1B2",
  "session_id": "customgpt-session-12345", 
  "status": "validated",
  "validation_gaps": [
    {
      "field_name": "work_type",
      "severity": "recommended",
      "message": "Work type helps utilities prepare appropriate response",
      "prompt_text": "What type of work is this? (Normal, Emergency, etc.)"
    }
  ],
  "next_prompt": "Almost done! What type of work is this? (Normal, Emergency, etc.)",
  "updated_fields": ["work_start_date", "cross_street", "caller_email", "work_duration_days", "excavator_company"]
}
```

**Iterative Process:**
- CustomGPT continues asking for missing fields based on `validation_gaps`
- Each `/update` call returns new validation status
- Process continues until `validation_gaps` array is empty or contains only non-required gaps

### Phase 3: Final Confirmation

**🔗 Step 5: Confirm and Generate Submission Packet**

```http
POST /tickets/{ticket_id}/confirm
```

**Request Body:**
```json
{
  "final_remarks": "Contact Mike Johnson at (713) 555-0199 before starting work",
  "confirm_accuracy": true
}
```

**Response:**
```json
{
  "success": true,
  "ticket_id": "A1B2",
  "session_id": "customgpt-session-12345",
  "status": "ready", 
  "submission_packet": {
    "texas811_fields": {
      "county": "Harris",
      "city": "Houston",
      "address": "1500 Louisiana Street, Houston, TX 77002",
      "cross_street": "Prairie Street",
      "work_description": "Install fiber optic cable for telecommunications",
      "caller_name": "Mike Johnson",
      "caller_company": "Houston Telecom Services",
      "caller_phone": "(713) 555-0199",
      "caller_email": "mike.johnson@houstontelecom.com",
      "excavator_company": "Houston Telecom Services",
      "work_start_date": "09/07/2025",
      "work_duration_days": 3,
      "work_type": "Normal"
    },
    "compliance_dates": {
      "lawful_start_date": "2025-09-05",
      "ticket_expires_date": "2025-09-16", 
      "marking_valid_until": "2025-09-19"
    },
    "geometry_data": {
      "gps_coordinates": {
        "latitude": 29.7589,
        "longitude": -95.3677
      }
    }
  },
  "summary": {
    "ticket_id": "A1B2",
    "location": "1500 Louisiana Street, Houston, TX 77002",
    "work_description": "Install fiber optic cable for telecommunications",
    "caller": "Mike Johnson",
    "lawful_start_date": "2025-09-05",
    "ready_for_submission": true,
    "submission_method": "Manual via Texas811 portal"
  }
}
```

### Phase 4: User Guidance

**💬 Step 6: CustomGPT Presents Results**
CustomGPT provides user-friendly summary and next steps:

> "✅ **Your Texas 811 ticket is ready for submission!**
> 
> **Ticket ID:** A1B2  
> **Location:** 1500 Louisiana Street, Houston, TX 77002  
> **Work:** Install fiber optic cable for telecommunications  
> **Earliest Start Date:** September 5, 2025  
> 
> **Next Steps:**
> 1. Submit this information to the Texas 811 portal manually
> 2. Wait for utility responses (you'll receive them by email/phone)
> 3. You can begin work on or after September 5, 2025
> 4. This ticket expires on September 16, 2025"

## Advanced Workflow Features

### Session Management

**📋 List Session Tickets**
```http
GET /tickets/session/{session_id}/tickets
```
Returns all tickets created in a CustomGPT session (supports multi-ticket workflows).

**🔍 Get Ticket Details**
```http
GET /tickets/{ticket_id}
```
Retrieve complete ticket information including enrichment data.

### Error Handling Patterns

**⚠️ Validation Errors (400)**
```json
{
  "error": "validation_error",
  "message": "Required fields missing",
  "validation_gaps": [
    {
      "field_name": "county",
      "severity": "required",
      "message": "County is required for Texas 811 submission"
    }
  ]
}
```

**🚫 Confirmation Blocked (422)**
```json
{
  "error": "unprocessable_entity", 
  "message": "Ticket not ready for confirmation",
  "validation_gaps": [
    {
      "field_name": "work_start_date",
      "severity": "required",
      "message": "Work start date is required"
    }
  ]
}
```

## CustomGPT Integration Patterns

### 1. **Progressive Data Collection**
- Start with any extracted PDF data
- Use `validation_gaps` to guide follow-up questions
- Update ticket iteratively as users provide information
- Maintain conversation context with `session_id`

### 2. **Smart Question Prioritization**
```json
"validation_gaps": [
  {
    "field_name": "work_start_date",
    "severity": "required",           // Ask first
    "prompt_text": "When do you plan to start work?"
  },
  {
    "field_name": "cross_street", 
    "severity": "recommended",        // Ask second
    "prompt_text": "What's the nearest cross street?"
  },
  {
    "field_name": "driving_directions",
    "severity": "info",               // Ask last or skip
    "prompt_text": "Any specific directions to the work site?"
  }
]
```

### 3. **Conversational Error Recovery**
When API calls fail, CustomGPT can:
- Retry with corrected data
- Ask user to clarify problematic fields
- Explain validation requirements in natural language

### 4. **Enrichment Feedback**
The system automatically enriches data and provides feedback:
```json
"gps_lat": 29.7589,
"gps_lng": -95.3677, 
"parcel_info": {
  "owner": "Downtown Properties LLC",
  "parcel_id": "123-456-789",
  "subdivision": "Downtown Historic District"
}
```

## Performance Targets

- **Create Ticket:** < 2 seconds (includes geocoding)
- **Update Ticket:** < 1 second
- **Confirm Ticket:** < 0.5 seconds
- **Session Timeout:** 1 hour (sliding window)

## Business Rules Integration

### Texas 811 Compliance
1. **2 Business Day Rule:** System calculates earliest lawful start date
2. **14-Day Validity:** Tickets automatically expire after 14 days
3. **Holiday Awareness:** Texas state holidays excluded from business day calculations

### Field Validation
- **Required Fields:** Must be completed before confirmation
- **Format Validation:** Phone numbers, emails, dates validated automatically
- **Business Logic:** Work start date cannot be before lawful start date

### Geocoding & Enrichment
- **Address Validation:** Automatic geocoding with confidence scores
- **GPS Fallback:** Manual GPS coordinates accepted if address fails
- **Parcel Data:** Automatic parcel enrichment from county GIS systems

## Error Recovery Strategies

### For CustomGPT Implementation:

1. **Validation Failures**
   ```javascript
   if (response.validation_gaps?.length > 0) {
     const requiredGaps = response.validation_gaps.filter(g => g.severity === 'required');
     if (requiredGaps.length > 0) {
       return `I need ${requiredGaps[0].prompt_text}`;
     }
   }
   ```

2. **Network Issues**
   - Implement exponential backoff retry
   - Cache partial responses for recovery
   - Provide meaningful error messages to users

3. **Session Expiry**
   - Detect expired sessions (401 responses)
   - Restart workflow if needed
   - Maintain user context across session boundaries

## Sample Complete Conversation Flow

```
User: [Uploads PDF work order]

CustomGPT: I've extracted your work order details:
- Location: 1500 Louisiana Street, Houston, TX  
- Work: Install fiber optic cable
- Caller: Mike Johnson

I need a few more details. When do you plan to start this work? (must be at least 2 business days from today)

User: We'd like to start Monday, September 7th.

CustomGPT: Perfect! What's the nearest cross street to 1500 Louisiana Street?

User: Prairie Street

CustomGPT: Almost done! What type of work is this - Normal, Emergency, or something else?

User: Normal construction work

CustomGPT: ✅ Your Texas 811 ticket is ready! 
- Ticket ID: A1B2
- Earliest start date: September 5, 2025
- Expires: September 16, 2025

[Displays formatted submission packet for manual Texas 811 portal entry]
```

---

This workflow enables CustomGPT to provide a seamless, conversational interface for complex Texas 811 compliance requirements while maintaining full backend validation and enrichment capabilities.
