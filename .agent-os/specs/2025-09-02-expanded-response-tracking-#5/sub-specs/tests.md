# Test Specification

This document defines the testing requirements for the expanded response tracking system.

> Created: 2025-09-02
> Version: 1.0.0

## Test Categories

### Unit Tests
- Member response model validation
- Status calculation logic
- Member list management
- Response uniqueness enforcement

### Integration Tests
- API endpoint functionality
- Database operations
- Status transitions
- Backward compatibility

### End-to-End Tests
- Complete response workflow
- Dashboard display updates
- Multi-member scenarios

## Unit Test Cases

### Response Model Validation

```python
def test_member_response_valid_status():
    """Test that only 'clear' and 'not_clear' statuses are accepted."""
    # Valid statuses should pass
    response = MemberResponseRequest(
        member_name="AT&T",
        status="clear",
        user_name="John Smith"
    )
    assert response.status == "clear"

    # Invalid status should raise ValidationError
    with pytest.raises(ValidationError):
        MemberResponseRequest(
            member_name="AT&T",
            status="maybe",
            user_name="John Smith"
        )

def test_member_response_required_fields():
    """Test that required fields are enforced."""
    # Missing member_name should fail
    with pytest.raises(ValidationError):
        MemberResponseRequest(
            status="clear",
            user_name="John Smith"
        )

    # Missing user_name should fail
    with pytest.raises(ValidationError):
        MemberResponseRequest(
            member_name="AT&T",
            status="clear"
        )

def test_member_response_optional_fields():
    """Test that optional fields can be omitted."""
    response = MemberResponseRequest(
        member_name="AT&T",
        status="clear",
        user_name="John Smith"
        # facilities and comment omitted
    )
    assert response.facilities is None
    assert response.comment is None
```

### Status Calculation Logic

```python
def test_status_no_expected_members():
    """Test status calculation when no expected members list."""
    ticket = Mock(expected_members=None, status="submitted")

    # No responses - keep current status
    assert calculate_ticket_status(ticket, []) == "submitted"

    # Has responses - set to responses_in
    responses = [Mock()]
    assert calculate_ticket_status(ticket, responses) == "responses_in"

def test_status_partial_responses():
    """Test status becomes 'in_progress' with partial responses."""
    ticket = Mock(expected_members=[
        {"code": "ATT", "name": "AT&T"},
        {"code": "ONCOR", "name": "Oncor"},
        {"code": "ATMOS", "name": "Atmos"}
    ])

    # One response - in_progress
    responses = [Mock(member_code="ATT")]
    assert calculate_ticket_status(ticket, responses) == "in_progress"

    # Two responses - still in_progress
    responses = [Mock(member_code="ATT"), Mock(member_code="ONCOR")]
    assert calculate_ticket_status(ticket, responses) == "in_progress"

def test_status_all_responses():
    """Test status becomes 'responses_in' when all respond."""
    ticket = Mock(expected_members=[
        {"code": "ATT", "name": "AT&T"},
        {"code": "ONCOR", "name": "Oncor"}
    ])

    responses = [
        Mock(member_code="ATT"),
        Mock(member_code="ONCOR")
    ]
    assert calculate_ticket_status(ticket, responses) == "responses_in"
```

### Member List Management

```python
def test_add_unknown_member():
    """Test that unknown members are added to expected list."""
    ticket = Mock(expected_members=[
        {"code": "ATT", "name": "AT&T"}
    ])

    # Submit response from unknown member
    handle_unknown_member(ticket, "ONCOR", "Oncor Electric")

    # Verify member was added
    assert len(ticket.expected_members) == 2
    assert any(m["code"] == "ONCOR" for m in ticket.expected_members)

def test_no_duplicate_members():
    """Test that existing members are not duplicated."""
    ticket = Mock(expected_members=[
        {"code": "ATT", "name": "AT&T"}
    ])

    # Try to add existing member
    handle_unknown_member(ticket, "ATT", "AT&T")

    # Verify no duplicate
    assert len(ticket.expected_members) == 1
```

## Integration Test Cases

### API Endpoint Tests

```python
@pytest.mark.asyncio
async def test_submit_member_response(client, test_ticket):
    """Test submitting a member response via API."""
    response = await client.post(
        f"/tickets/{test_ticket.id}/responses/ATT",
        json={
            "member_name": "AT&T",
            "status": "clear",
            "facilities": "2 lines",
            "comment": "Marked",
            "user_name": "John Smith"
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["success"] == True
    assert data["response"]["member_code"] == "ATT"
    assert data["response"]["status"] == "clear"
    assert data["ticket_status"] == "in_progress"

@pytest.mark.asyncio
async def test_update_existing_response(client, test_ticket):
    """Test updating an existing member response."""
    # Submit initial response
    await client.post(
        f"/tickets/{test_ticket.id}/responses/ATT",
        json={
            "member_name": "AT&T",
            "status": "clear",
            "user_name": "John Smith"
        }
    )

    # Update the response
    response = await client.post(
        f"/tickets/{test_ticket.id}/responses/ATT",
        json={
            "member_name": "AT&T",
            "status": "not_clear",
            "comment": "Found additional lines",
            "user_name": "Jane Doe"
        }
    )

    assert response.status_code == 200  # Update returns 200, not 201
    data = response.json()
    assert data["response"]["status"] == "not_clear"
    assert data["response"]["comment"] == "Found additional lines"

@pytest.mark.asyncio
async def test_get_ticket_responses(client, test_ticket_with_responses):
    """Test retrieving all responses for a ticket."""
    response = await client.get(
        f"/tickets/{test_ticket_with_responses.id}/responses"
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["responses"]) == 2
    assert data["summary"]["expected_count"] == 3
    assert data["summary"]["received_count"] == 2
    assert len(data["summary"]["pending_members"]) == 1
```

### Database Operation Tests

```python
@pytest.mark.asyncio
async def test_unique_constraint(db_session):
    """Test that duplicate member responses are prevented."""
    ticket_id = 1

    # Insert first response
    await db_session.execute(
        """INSERT INTO member_responses
        (ticket_id, member_code, member_name, status, user_name)
        VALUES ($1, $2, $3, $4, $5)""",
        ticket_id, "ATT", "AT&T", "clear", "John"
    )

    # Try to insert duplicate - should fail
    with pytest.raises(UniqueViolationError):
        await db_session.execute(
            """INSERT INTO member_responses
            (ticket_id, member_code, member_name, status, user_name)
            VALUES ($1, $2, $3, $4, $5)""",
            ticket_id, "ATT", "AT&T", "not_clear", "Jane"
        )

@pytest.mark.asyncio
async def test_cascade_delete(db_session):
    """Test that responses are deleted when ticket is deleted."""
    # Create ticket and responses
    ticket_id = await create_test_ticket(db_session)
    await create_test_response(db_session, ticket_id, "ATT")
    await create_test_response(db_session, ticket_id, "ONCOR")

    # Delete ticket
    await db_session.execute("DELETE FROM tickets WHERE id = $1", ticket_id)

    # Verify responses were deleted
    result = await db_session.fetch(
        "SELECT COUNT(*) FROM member_responses WHERE ticket_id = $1",
        ticket_id
    )
    assert result[0]["count"] == 0
```

## End-to-End Test Cases

### Complete Response Workflow

```python
@pytest.mark.e2e
async def test_complete_response_workflow():
    """Test full workflow from ticket creation to all responses received."""
    # 1. Create ticket with expected members
    ticket = await create_ticket_with_members(["ATT", "ONCOR", "ATMOS"])
    assert ticket.status == "submitted"

    # 2. Submit first response
    await submit_response(ticket.id, "ATT", "clear")
    ticket = await get_ticket(ticket.id)
    assert ticket.status == "in_progress"

    # 3. Submit second response
    await submit_response(ticket.id, "ONCOR", "not_clear")
    ticket = await get_ticket(ticket.id)
    assert ticket.status == "in_progress"

    # 4. Submit final response
    await submit_response(ticket.id, "ATMOS", "clear")
    ticket = await get_ticket(ticket.id)
    assert ticket.status == "responses_in"

    # 5. Verify dashboard shows correct summary
    dashboard = await get_dashboard_data()
    ticket_summary = find_ticket_in_dashboard(dashboard, ticket.id)
    assert ticket_summary["response_summary"]["received_count"] == 3
    assert ticket_summary["response_summary"]["has_not_clear"] == True
```

### Unknown Member Handling

```python
@pytest.mark.e2e
async def test_unknown_member_response():
    """Test handling response from unexpected utility."""
    # Create ticket with 2 expected members
    ticket = await create_ticket_with_members(["ATT", "ONCOR"])

    # Submit response from unknown member
    await submit_response(ticket.id, "ATMOS", "clear", "Atmos Energy")

    # Verify member was added to expected list
    ticket = await get_ticket(ticket.id)
    assert len(ticket.expected_members) == 3
    assert any(m["code"] == "ATMOS" for m in ticket.expected_members)

    # Status should be in_progress (1 of 3 responded)
    assert ticket.status == "in_progress"
```

## Performance Tests

### Response Time Requirements

```python
@pytest.mark.performance
async def test_response_submission_performance():
    """Test that response submission completes within 500ms."""
    ticket = await create_test_ticket()

    start_time = time.time()
    await submit_response(ticket.id, "ATT", "clear")
    elapsed = time.time() - start_time

    assert elapsed < 0.5, f"Response took {elapsed}s, expected < 0.5s"

@pytest.mark.performance
async def test_response_list_performance():
    """Test that response list retrieval completes within 200ms."""
    ticket = await create_ticket_with_many_responses(20)

    start_time = time.time()
    await get_ticket_responses(ticket.id)
    elapsed = time.time() - start_time

    assert elapsed < 0.2, f"Retrieval took {elapsed}s, expected < 0.2s"
```

## Backward Compatibility Tests

### Legacy Field Population

```python
def test_legacy_fields_updated():
    """Test that legacy response fields are maintained."""
    ticket = create_test_ticket()

    # Submit first response
    submit_response(ticket.id, "ATT", "clear")

    # Verify legacy fields updated
    assert ticket.response_date is not None
    assert ticket.response_status == "positive"

    # Submit not_clear response
    submit_response(ticket.id, "ONCOR", "not_clear")

    # Verify legacy status changed
    assert ticket.response_status == "conditional"
```

## Test Data Fixtures

```python
@pytest.fixture
async def test_ticket():
    """Create a test ticket with expected members."""
    return await create_ticket({
        "ticket_number": "TEST-001",
        "expected_members": [
            {"code": "ATT", "name": "AT&T"},
            {"code": "ONCOR", "name": "Oncor Electric"},
            {"code": "ATMOS", "name": "Atmos Energy"}
        ]
    })

@pytest.fixture
async def test_ticket_with_responses():
    """Create a test ticket with some responses."""
    ticket = await test_ticket()
    await submit_response(ticket.id, "ATT", "clear")
    await submit_response(ticket.id, "ONCOR", "not_clear")
    return ticket
```

## Coverage Requirements

### Minimum Coverage Targets
- Unit Tests: 90% coverage
- Integration Tests: 80% coverage
- API Endpoints: 100% coverage
- Critical Business Logic: 100% coverage

### Critical Paths to Test
1. Response submission and update
2. Status calculation and transitions
3. Member list management
4. Dashboard summary calculations
5. Backward compatibility with legacy fields
