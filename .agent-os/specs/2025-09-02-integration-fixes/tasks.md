# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-02-integration-fixes/spec.md

> Created: 2025-09-03
> Status: Ready for Implementation

## Tasks

### 1. Backend - Create Missing Responses API Endpoint
**Goal**: Enable frontend to fetch utility member response data
**Priority**: High (blocking frontend fixes)

- [ ] 1.1 Write unit tests for responses endpoint
  - [ ] 1.1.1 Test GET `/tickets/{ticket_id}/responses` returns expected response format
  - [ ] 1.1.2 Test response aggregation from multiple JSON files in `/data/responses/{ticket_id}/`
  - [ ] 1.1.3 Test handling of missing response directory
  - [ ] 1.1.4 Test expected members list includes all members from ticket data
  - [ ] 1.1.5 Test response format includes member_code, member_name, status, facilities, comment

- [ ] 1.2 Implement responses endpoint in dashboard_endpoints.py
  - [ ] 1.2.1 Create `get_ticket_responses` function to aggregate response files
  - [ ] 1.2.2 Add GET `/tickets/{ticket_id}/responses` route handler
  - [ ] 1.2.3 Handle cases where response directory doesn't exist
  - [ ] 1.2.4 Return both actual responses and expected members list
  - [ ] 1.2.5 Format response data with proper member details

- [ ] 1.3 Run tests and verify endpoint functionality
  - [ ] 1.3.1 Execute unit tests and ensure all pass
  - [ ] 1.3.2 Test with real ticket data (ticket 0AT0)
  - [ ] 1.3.3 Verify API response format matches frontend expectations

### 2. Backend - Fix Submission Packet Generation
**Goal**: Ensure all tickets have complete submission_packet data
**Priority**: Medium (fixes packet view display)

- [ ] 2.1 Write tests for submission packet generation
  - [ ] 2.1.1 Test packet generation includes all Texas811 required fields
  - [ ] 2.1.2 Test packet data format matches expected structure
  - [ ] 2.1.3 Test packet creation when ticket reaches READY status

- [ ] 2.2 Update ticket confirmation endpoint
  - [ ] 2.2.1 Ensure submission_packet is generated and stored for all tickets
  - [ ] 2.2.2 Include all required fields in proper Texas811 format
  - [ ] 2.2.3 Store packet data when ticket status becomes READY

- [ ] 2.3 Run tests and verify packet generation
  - [ ] 2.3.1 Execute unit tests and ensure all pass
  - [ ] 2.3.2 Test with existing tickets to generate missing packet data

### 3. Frontend - Fix Map GPS Validation and Address Fallback
**Goal**: Display map correctly when GPS coordinates are invalid
**Priority**: High (critical user experience issue)

- [ ] 3.1 Write tests for GPS validation in GeoMapBox component
  - [ ] 3.1.1 Test GPS coordinate validation (lat: -90 to 90, lng: -180 to 180)
  - [ ] 3.1.2 Test fallback to address geocoding when GPS is invalid
  - [ ] 3.1.3 Test map centering with valid coordinates
  - [ ] 3.1.4 Test map centering with address fallback
  - [ ] 3.1.5 Test display of address marker when GPS unavailable

- [ ] 3.2 Update GeoMapBox component with validation logic
  - [ ] 3.2.1 Add GPS coordinate validation function
  - [ ] 3.2.2 Implement address geocoding fallback using Mapbox API
  - [ ] 3.2.3 Update map centering logic to handle invalid GPS
  - [ ] 3.2.4 Add address marker display when GPS is unavailable
  - [ ] 3.2.5 Handle error cases gracefully

- [ ] 3.3 Run tests and verify map display fixes
  - [ ] 3.3.1 Execute component tests and ensure all pass
  - [ ] 3.3.2 Test with ticket 0AT0 (invalid GPS: lat 1.0, lng 2025.0)
  - [ ] 3.3.3 Verify map centers on address when GPS is invalid

### 4. Frontend - Add Responses API Client Integration
**Goal**: Connect frontend to new responses endpoint
**Priority**: High (enables response display fixes)

- [ ] 4.1 Write tests for responses API integration
  - [ ] 4.1.1 Test API client function for fetching ticket responses
  - [ ] 4.1.2 Test error handling for missing responses
  - [ ] 4.1.3 Test response data parsing and formatting

- [ ] 4.2 Update API client and proxy route
  - [ ] 4.2.1 Add `getTicketResponses` function to lib/api.ts
  - [ ] 4.2.2 Update proxy route in app/api/tickets/[id]/responses/route.ts
  - [ ] 4.2.3 Handle API errors and loading states

- [ ] 4.3 Run tests and verify API integration
  - [ ] 4.3.1 Execute API tests and ensure all pass
  - [ ] 4.3.2 Test with real ticket data to verify data flow

### 5. Frontend - Reorganize Overview Tab Layout
**Goal**: Improve UI organization to match Texas811 submission flow
**Priority**: Medium (user experience improvement)

- [ ] 5.1 Write tests for reorganized Overview tab
  - [ ] 5.1.1 Test Utility Responses section displays all expected members
  - [ ] 5.1.2 Test Current Summary section remains functional
  - [ ] 5.1.3 Test Map and Location section includes driving directions
  - [ ] 5.1.4 Test Work Description section displays all required fields
  - [ ] 5.1.5 Test proper section ordering and visibility

- [ ] 5.2 Update ticket detail page component structure
  - [ ] 5.2.1 Reorder sections: Utility Responses (top), Current Summary, Map and Location, Work Description
  - [ ] 5.2.2 Rename "Map & Description" to "Map and Location"
  - [ ] 5.2.3 Add driving_directions field to Map and Location section
  - [ ] 5.2.4 Create Work Description section with marking_instructions, remarks, caller_company, work_type, work_description
  - [ ] 5.2.5 Add duration, explosives, white_lining_complete fields to Work Description

- [ ] 5.3 Run tests and verify layout reorganization
  - [ ] 5.3.1 Execute component tests and ensure all pass
  - [ ] 5.3.2 Test with real ticket data to verify all sections display correctly
  - [ ] 5.3.3 Verify responsive layout works on different screen sizes

### 6. Frontend - Fix Response Display to Show All Members
**Goal**: Display complete utility member response status
**Priority**: High (critical functionality)

- [ ] 6.1 Write tests for updated response display
  - [ ] 6.1.1 Test display of all expected members from ticket data
  - [ ] 6.1.2 Test "No response yet" status for non-responding members
  - [ ] 6.1.3 Test response details display (facilities, comments) when available
  - [ ] 6.1.4 Test response status indicators and formatting

- [ ] 6.2 Update Utility Responses section in ticket page
  - [ ] 6.2.1 Fetch expected_members from ticket data
  - [ ] 6.2.2 Fetch actual responses from new API endpoint
  - [ ] 6.2.3 Display all expected members with response status
  - [ ] 6.2.4 Show "No response yet" for members who haven't responded
  - [ ] 6.2.5 Include response details (facilities, comments) when available

- [ ] 6.3 Run tests and verify response display
  - [ ] 6.3.1 Execute component tests and ensure all pass
  - [ ] 6.3.2 Test with ticket 0AT0 which has responses
  - [ ] 6.3.3 Verify all expected members show in responses table

### 7. Frontend - Fix Packet View Data Mapping
**Goal**: Display complete submission packet data in correct Texas811 format
**Priority**: Medium (data presentation improvement)

- [ ] 7.1 Write tests for updated packet view mapping
  - [ ] 7.1.1 Test Location section displays address and driving directions
  - [ ] 7.1.2 Test Instructions section displays locate instructions and remarks
  - [ ] 7.1.3 Test Work Details section displays type, nature, company, duration
  - [ ] 7.1.4 Test Flags section displays equipment type, explosives, boring, depth flags

- [ ] 7.2 Update SubmitPacketView component data mapping
  - [ ] 7.2.1 Map Location fields: address, driving_directions
  - [ ] 7.2.2 Map Instructions fields: marking_instructions, remarks
  - [ ] 7.2.3 Map Work Details fields: work_type, work_description, caller_company, duration
  - [ ] 7.2.4 Map Flags fields: explosives_used, white_lining_complete, boring_crossing, depth
  - [ ] 7.2.5 Handle missing or null packet data gracefully

- [ ] 7.3 Run tests and verify packet view fixes
  - [ ] 7.3.1 Execute component tests and ensure all pass
  - [ ] 7.3.2 Test with tickets that have complete submission_packet data
  - [ ] 7.3.3 Verify all fields display correctly in Texas811 format

### 8. Integration Testing and Validation
**Goal**: Ensure all fixes work together properly
**Priority**: High (system validation)

- [ ] 8.1 End-to-end testing with real data
  - [ ] 8.1.1 Test complete workflow with ticket 0AT0
  - [ ] 8.1.2 Verify responses display correctly for all expected members
  - [ ] 8.1.3 Verify map displays with address fallback for invalid GPS
  - [ ] 8.1.4 Verify Overview tab shows all sections in correct order
  - [ ] 8.1.5 Verify Packet view displays complete submission data

- [ ] 8.2 Cross-browser and responsive testing
  - [ ] 8.2.1 Test functionality in Chrome, Firefox, Safari
  - [ ] 8.2.2 Test responsive layout on mobile and tablet devices
  - [ ] 8.2.3 Verify map component works across browsers

- [ ] 8.3 Performance and error handling validation
  - [ ] 8.3.1 Test API response times for responses endpoint
  - [ ] 8.3.2 Test error handling for missing data scenarios
  - [ ] 8.3.3 Test loading states and user feedback
