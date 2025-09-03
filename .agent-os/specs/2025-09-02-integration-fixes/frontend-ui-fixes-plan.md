# Frontend UI Issues - Comprehensive Fix Plan

## Analysis Summary

After reviewing the code, I've identified the following issues:

1. **Responses Not Rendering**: The backend has response data stored in `/data/responses/{ticket_id}/` as individual JSON files per utility member, but there's no API endpoint to fetch these responses. The frontend expects a `/tickets/{ticket_id}/responses` endpoint that doesn't exist.

2. **Map GPS Issue**: The ticket data shows incorrect GPS coordinates (lat: 1.0, lng: 2025.0) which are clearly not valid. The map component needs to use address geocoding instead when GPS is invalid.

3. **UI Organization**: The current Overview tab layout doesn't match the Texas811 submission flow and is missing key information sections.

4. **Packet Data Not Loading**: The submission_packet field is null in most tickets, so the packet view shows empty data.

## Fix Plan

### 1. Backend - Add Missing Responses Endpoint
- Create GET `/tickets/{ticket_id}/responses` endpoint in `dashboard_endpoints.py`
- Aggregate response files from `/data/responses/{ticket_id}/` directory
- Return both actual responses and expected members list
- Format: Include member_code, member_name, status, facilities, comment

### 2. Frontend - Fix Response Display
- Update the API client to fetch responses from new endpoint
- Display all expected members with their response status
- Show "No response yet" for members who haven't responded
- Include response details (facilities, comments) when available

### 3. Frontend - Fix Map Display
- Update GeoMapBox component to use address geocoding when GPS is invalid
- Add validation: GPS lat must be between -90 and 90, lng between -180 and 180
- Implement fallback to address-based centering using Mapbox Geocoding API
- Display address marker when GPS is unavailable

### 4. Frontend - Reorganize Overview Tab
Order sections as:
1. **Utility Responses** (moved to top)
   - List ALL expected members
   - Show response status for each
2. **Current Summary** (existing)
3. **Map and Location** (renamed from "Map & Description")
   - Add driving directions field display
4. **Work Description** (new section)
   - Locate instructions (marking_instructions)
   - Additional remarks
   - Work for (caller_company)
   - Equipment type (work_type)
   - Nature of work (work_description)
   - Duration, explosives, white lining flags

### 5. Frontend - Fix Packet View
Update data mapping to match Texas811 submission order:
- Location: Address, Driving Directions
- Instructions: Locate Instructions, Additional Remarks
- Work Details: Type, Nature, For company, Duration
- Flags: Equipment type, Explosives, White lined, Directional boring, Depth

### 6. Backend - Ensure Submission Packet Generation
- Update ticket confirmation endpoint to always generate submission_packet
- Include all required fields in proper Texas811 format
- Store packet data when ticket reaches READY status

## Implementation Order
1. Create responses API endpoint (backend)
2. Fix map GPS validation and address fallback (frontend)
3. Reorganize Overview tab sections (frontend)
4. Fix Packet view data mapping (frontend)
5. Update response display to show all members (frontend)
6. Test with real ticket data

## Key Files to Modify

### Backend
- `/home/james/dev/811poc/src/texas811_poc/dashboard_endpoints.py` - Add responses endpoint
- `/home/james/dev/811poc/src/texas811_poc/api_endpoints.py` - Fix submission packet generation

### Frontend
- `/home/james/dev/811poc/frontend/app/tickets/[id]/page.tsx` - Reorganize sections, fix response display
- `/home/james/dev/811poc/frontend/components/map/GeoMapBox.tsx` - Add GPS validation and address fallback
- `/home/james/dev/811poc/frontend/components/packet/SubmitPacketView.tsx` - Fix field mapping
- `/home/james/dev/811poc/frontend/lib/api.ts` - Add responses endpoint call
- `/home/james/dev/811poc/frontend/app/api/tickets/[id]/responses/route.ts` - Update proxy route

## Data Model Alignment

### Backend Fields → Frontend Display
- `expected_members` → Show all in responses table
- `driving_directions` → Display in Map and Location section
- `marking_instructions` → Display as "Locate Instructions"
- `remarks` → Display as "Additional Remarks"
- `work_type` → Display as "Equipment Type"
- `caller_company` → Display as "Work For"
- `explosives_used`, `white_lining_complete`, `boring_crossing` → Display as flags

## Testing Notes
- Test with ticket 0AT0 which has responses but invalid GPS
- Verify all expected members show in responses table
- Confirm map falls back to address when GPS is invalid
- Check packet view displays all fields correctly
