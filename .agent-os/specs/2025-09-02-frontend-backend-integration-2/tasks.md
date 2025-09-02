# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/2025-09-02-frontend-backend-integration-2/spec.md

> Created: 2025-09-02
> Status: Ready for Implementation

## Tasks

### Task 1: API Client Setup (Est: 2 hours)
- [ ] 1.1: Install axios HTTP client library
- [ ] 1.2: Create `/lib/api-client.ts` with base configuration
- [ ] 1.3: Define TypeScript interfaces matching existing mock data structures
- [ ] 1.4: Set up error handling wrapper functions
- [ ] 1.5: Configure CORS handling for localhost development

**Definition of Done:** API client configured and ready for endpoint integration with proper TypeScript types matching existing component expectations.

### Task 2: Wire GET Endpoints (Est: 3 hours)
- [ ] 2.1: Replace mock data in `/app/tickets/page.tsx` with GET /api/tickets
- [ ] 2.2: Replace mock data in `/app/tickets/[id]/page.tsx` with GET /api/tickets/{id}
- [ ] 2.3: Verify existing loading states work with real API timing
- [ ] 2.4: Test error handling with existing UI error components
- [ ] 2.5: Confirm data displays correctly in existing UI components

**Definition of Done:** Dashboard and detail pages display real backend data using existing UI components without modifications.

### Task 3: Wire POST Endpoints (Est: 3 hours)
- [ ] 3.1: Replace mock ticket creation in form submission components
- [ ] 3.2: Integrate POST /api/tickets with existing form validation
- [ ] 3.3: Replace mock validation calls with POST /api/tickets/{id}/validate
- [ ] 3.4: Ensure validation responses display in existing error UI
- [ ] 3.5: Test successful creation flow updates dashboard immediately

**Definition of Done:** Ticket creation and validation use real API endpoints while preserving existing form behavior and UI patterns.

### Task 4: Wire PATCH Endpoints (Est: 2 hours)
- [ ] 4.1: Replace mock status updates with PATCH /api/tickets/{id}
- [ ] 4.2: Integrate status change UI with real backend updates
- [ ] 4.3: Ensure optimistic UI updates work with API confirmation
- [ ] 4.4: Handle API errors gracefully in status update components
- [ ] 4.5: Test that status changes persist and refresh correctly

**Definition of Done:** Status updates communicate with backend and persist changes while maintaining existing UI interaction patterns.

### Task 5: Playwright Test Implementation (Est: 4 hours)
- [ ] 5.1: Set up Playwright test configuration for integration testing
- [ ] 5.2: Create E2E test for dashboard ticket list integration (E2E-001)
- [ ] 5.3: Create E2E test for ticket detail page integration (E2E-002)
- [ ] 5.4: Create E2E test for ticket creation integration (E2E-003)
- [ ] 5.5: Create E2E test for status update integration (E2E-004)
- [ ] 5.6: Create E2E test for validation workflow integration (E2E-005)
- [ ] 5.7: Create E2E test for API error handling integration (E2E-006)

**Definition of Done:** Complete Playwright test suite verifies all frontend-backend integration points work correctly.

### Task 6: End-to-End Testing (Est: 2 hours)
- [ ] 6.1: Start both frontend and backend servers
- [ ] 6.2: Seed backend with test data for integration testing
- [ ] 6.3: Run complete Playwright test suite and verify all tests pass
- [ ] 6.4: Manual testing of all integration points to confirm UI behavior
- [ ] 6.5: Document any integration issues discovered and resolved
- [ ] 6.6: Verify no existing UI components were modified during integration

**Definition of Done:** All integration tests pass, manual testing confirms functionality works end-to-end, and existing UI components remain unchanged.

## Integration Acceptance Criteria

### Functional Requirements
- [ ] Dashboard displays real tickets from backend API
- [ ] Ticket detail pages load complete data from backend
- [ ] Form submissions create actual backend tickets
- [ ] Status updates persist to backend database
- [ ] Validation workflow uses real backend validation logic
- [ ] All existing UI components work without modification

### Technical Requirements
- [ ] API client properly configured with error handling
- [ ] All mock API calls replaced with real endpoint calls
- [ ] TypeScript interfaces match both frontend and backend expectations
- [ ] CORS configuration allows frontend-backend communication
- [ ] Loading states work appropriately with API response times

### Quality Requirements
- [ ] Playwright tests cover all critical integration points
- [ ] Error handling preserves existing UI error display patterns
- [ ] No modifications made to existing React components
- [ ] API responses display correctly in existing UI elements
- [ ] Performance meets existing UI expectations for load times
