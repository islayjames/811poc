### NON-NEGOTIABLE INSTRUCTIONS ###

## Use of Agents ##
You must prefer the use of specialized agents wherever possible. In particular:
- tech-lead-orchestrator: develops and monitors specs and tasks; delegates technical work
- backend-developer: handles backend development work and unit test development and execution; receives tasks when ready for executions, hands off when unit tests pass
- test-runner: receives completed work backend-developer, assessess if further testing is required or if it's ready for presentation to the user
- deep-debugger: expert debugger to reconcile issues surfaced during testing or by the user, to really explore the codebase and functional requirements and craft a solution
- file-system-manager: handles all miscellaneous file system access in a controlled, careful manner
- documentation-specialist: updates system functional and technical documentation once development of a task or spec is complete

Other available agents should be used as well, as appropriate. 

### Core Design Principles
- **Backend-First POC**: Focus on backend foundation before UI polish
- **Data-First Output**: Produce Texas811-ready submission packets as primary deliverable
- **Clear Integration Points**: Standardized JSON contracts between CustomGPT and backend
- **Compliance Focus**: Lawful timing calculations and ticket lifecycle management
- **Real-Data Testing**: Every component must be validated against sample work orders
- **Definition of Done**: A feature is NOT complete if core functionality is not working
  - Missing dependencies (e.g., API keys, geocoding service) mean the feature is NOT done
  - "Would work under different circumstances" is NOT done
  - All advertised capabilities must be functional before marking complete
  - Test with actual PDF work orders and confirm actual results

## POC Components

### Component 1: PDF Extraction Interface (CustomGPT)
**Purpose**: OCR and field extraction from PDF work orders
**Input**: PDF work order uploads
**Processing**: Vision-based extraction to strict JSON schema
**Output**: Standardized JSON with Texas811 required fields
**Status**: To be implemented

### Component 2: Backend Enrichment Service
**Purpose**: Validate, geocode, compute dates, generate geofences
**Input**: Strict JSON from CustomGPT
**Processing**: 
- Field validation against Texas811 requirements
- Geocoding (address to GPS coordinates)
- Lawful start date calculation (+2 business days)
- Ticket lifecycle computation (14-day model)
- Simple geofence generation
**Output**: Enriched ticket draft with gap checklist
**Status**: To be implemented

### Component 3: Gap Resolution Wizard
**Purpose**: Interactive field completion for missing/unclear data
**Input**: Gap checklist from backend
**Processing**: Conversational prompts in CustomGPT
**Output**: Completed field values
**Status**: To be implemented

### Component 4: Submission Packet Generator
**Purpose**: Create Texas811-ready submission packets
**Input**: Validated and enriched ticket data
**Processing**: Format data to match Texas811 portal requirements
**Output**: Portal-aligned packet with all required fields
**Status**: To be implemented

### Component 5: Status Tracking Dashboard
**Purpose**: Lightweight ticket lifecycle management
**Input**: Ticket submissions and manual status updates
**Processing**: 
- Track submission status
- Calculate days remaining
- Monitor marking validity windows
**Output**: Status dashboard with countdown timers
**Status**: To be implemented

## AgentOS Project Configuration

### Reference Project Files
Always reference these AgentOS standard locations for project configuration:
- **Roadmap & Priorities**: @.agent-os/product/roadmap.md
- **Technical Stack**: @.agent-os/product/tech-stack.md
- **Architecture Decisions**: @.agent-os/product/decisions.md
- **Active Specifications**: @.agent-os/specs/
- **Current Tasks**: @.agent-os/specs/[current-spec]/tasks.md

### Current Development
- **Active Spec**: Texas811 POC Specification
- **Phase in Development**: Phase A - Backend Foundation
- **Task Status**: Review tasks.md in active spec folder

## Implementation Standards

### Component Implementation
Each component is implemented following these standards:
- Clear API contracts (JSON schemas documented)
- Comprehensive error handling and validation
- Audit logging for compliance tracking
- Unit and integration test coverage
- Real PDF test data validation

### Data Flow Standards
The POC data flow must:
1. Accept PDF uploads via CustomGPT interface
2. Extract fields using GPT vision capabilities
3. Post strict JSON to backend enrichment service
4. Validate and enrich data (geocoding, date calculations)
5. Handle gap resolution through wizard interaction
6. Generate Texas811-compliant submission packets
7. Track ticket lifecycle with manual status updates

### Texas811 Compliance Requirements
Always reference official Texas811 requirements:
- **Required Fields**: County, city, address OR GPS, cross street, work description
- **Timing Rules**: 2 business days wait period (excluding weekends/holidays)
- **Ticket Lifecycle**: 14-day ticket life, 14-day marking validity from positive response
- **Ticket Types**: Normal, Emergency, No Response, Update, Update & Remark, Dig Up

## Testing Requirements

### Test Data Location
**POC Test Dataset**: `~/dev/texas811-poc/test-data/`
- Sample PDF work orders (various formats)
- Expected extraction results (JSON)
- Edge cases (missing fields, ambiguous locations)
- Validation test cases

### Testing Strategy
1. **PDF Extraction Tests**: Validate OCR accuracy and field mapping
2. **Enrichment Tests**: Verify geocoding, date calculations, geofence generation
3. **Gap Resolution Tests**: Ensure wizard handles all missing field scenarios
4. **Compliance Tests**: Confirm lawful timing and ticket lifecycle calculations
5. **Integration Tests**: End-to-end flow from PDF to submission packet
6. **Dashboard Tests**: Verify status tracking and countdown accuracy

### Component Definition of Done
A component is NOT complete until ALL criteria are met:
- [ ] Input validation implemented
- [ ] Core processing logic complete
- [ ] Output schema defined and documented
- [ ] Error handling comprehensive
- [ ] Unit tests passing
- [ ] **REQUIRED: Tested successfully against sample PDF work orders**
- [ ] Integration with adjacent components validated
- [ ] Component documentation complete
- [ ] Performance acceptable with real PDFs

## Development Approach

### Following Global Standards
This project follows all standards defined in the global methodology:
- Use the complete sub-agent mesh for development
- Follow AgentOS spec-driven development process
- Maintain specs in @.agent-os/specs/
- Update tasks.md as work progresses
- Commit regularly to preserve progress

### POC Development Guidelines
When working on any component:
1. Start by understanding Texas811 portal requirements
2. Define clear JSON schemas for data exchange
3. Build validation before enrichment
4. Ensure compliance calculations are accurate
5. Create comprehensive test cases
6. **Validate with real PDF work orders before marking complete**
7. Document API contracts and configuration options
8. Create user-facing documentation for the gap wizard

### Sub-Agent Utilization
For this POC project:
- **tech-lead-orchestrator**: Design component boundaries and API contracts
- **backend-developer**: Implement enrichment service and submission packet generator
- **frontend-developer**: Create status tracking dashboard
- **test-runner**: Validate PDF extraction and compliance calculations
- **documentation-specialist**: Document API schemas and user workflows
- **code-reviewer**: Ensure Texas811 compliance and data accuracy

## Phase Implementation Plan

### Phase A: Backend Foundation (Current)
**Goal**: Core functionality without UI polish
**Deliverables**:
- JSON extraction from PDFs via CustomGPT
- Backend enrichment service (validation, geocoding, date calc)
- Gap resolution wizard logic
- Submission packet generator
- Minimal status tracking (manual updates)

**Success Metrics**:
- < 5 minutes from PDF to submission packet
- ≥ 95% required field population
- Accurate lawful start calculations
- ≤ 2 clarification prompts needed

### Phase B: Nice-to-Have Polish (POC Extension)
**Goal**: Enhanced usability features
**Potential Additions**:
- Static Texas holiday calendar for date calculations
- "No Response" reminder notifications
- Print-ready packet formatting
- Enhanced geofence visualization

### Phase C: Post-POC Runway (If Approved)
**Goal**: Production-ready features
**Future Capabilities**:
- Playwright portal automation
- Email/portal callback integration
- Multi-state support
- Advanced GIS features (parcel/ROW data)

## Known Constraints

### Design Decisions
- No portal automation in POC (manual submission)
- No email ingestion (manual status updates)
- Simple geofencing (box or polyline buffer)
- CustomGPT for user interface (not custom UI)
- Python backend for all processing

### Non-Goals for POC
- NOT automating Texas811 portal submission
- NOT integrating with utility member systems
- NOT processing email responses automatically
- NOT supporting multi-state operations
- NOT implementing complex GIS features

## Critical Reminders

### Real PDF Testing is Mandatory
**No component can be marked complete without successful testing against real work order PDFs**

This is non-negotiable and part of the Definition of Done for every component.

### Texas811 Compliance is Essential
All implementations must reference official Texas811 requirements:
- Field requirements from texas811.org
- Legal timing from Texas Admin Code
- Ticket lifecycle rules
- Marking validity periods

### AgentOS References
Always check the AgentOS project files for:
- Current technical decisions
- Updated roadmap and priorities  
- Active specifications and tasks
- Technology stack details

### Demo Script Validation
The POC must successfully execute the demo script:
1. Upload sample work order PDF → auto-extraction
2. One quick clarification → submit-ready packet
3. Mark Submitted → display earliest lawful start
4. Positive Responses → show "Ready to Dig" with countdown

### CRITICAL INSTRUCTION ###

Before executing a step, evaluate: is there an available agent that should handle this? If so, in all cases prefer delegation to agents over executing in the main session.

---

*This POC configuration extends the global AgentOS methodology*
*Ensure all development follows the spec-driven process*
*Leverage the full sub-agent mesh for implementation*
*REMEMBER: Real PDF testing with sample work orders is required for component completion*

## Agent OS Documentation

### Product Context
- **Mission & Vision:** @.agent-os/product/mission.md
- **Technical Architecture:** @.agent-os/product/tech-stack.md
- **Development Roadmap:** @.agent-os/product/roadmap.md
- **Decision History:** @.agent-os/product/decisions.md

### Development Standards
- **Code Style:** @~/.agent-os/standards/code-style.md
- **Best Practices:** @~/.agent-os/standards/best-practices.md

### Project Management
- **Active Specs:** @.agent-os/specs/
- **Spec Planning:** Use `@~/.agent-os/instructions/core/create-spec.md`
- **Tasks Execution:** Use `@~/.agent-os/instructions/core/execute-tasks.md`

## Workflow Instructions

When asked to work on this codebase:

1. **First**, check @.agent-os/product/roadmap.md for current priorities
2. **Then**, follow the appropriate instruction file:
   - For new features: @.agent-os/instructions/create-spec.md
   - For tasks execution: @.agent-os/instructions/execute-tasks.md
3. **Always**, adhere to the standards in the files listed above

## Important Notes

- Product-specific files in `.agent-os/product/` override any global standards
- User's specific instructions override (or amend) instructions found in `.agent-os/specs/...`
- Always adhere to established patterns, code style, and best practices documented above.
