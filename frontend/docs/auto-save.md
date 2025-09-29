# Auto-Save Functionality

This document describes the auto-save functionality implemented for TRD-008 in the Texas811 POC UI Enhancement project.

## Overview

The auto-save system provides automatic saving of form data every 30 seconds with local storage backup, status indicators, and conflict resolution for the ticket editing interface.

## Components

### 1. `useAutoSave` Hook (`/hooks/use-auto-save.ts`)

Custom React hook that provides comprehensive auto-save functionality:

**Features:**
- Timer-based auto-save (default: 30 seconds)
- Debounced change detection (default: 1 second)
- Local storage backup for offline editing
- Status tracking with visual feedback
- Manual save trigger
- Conflict detection support

**Configuration:**
```typescript
interface AutoSaveConfig {
  interval: number // Auto-save interval in milliseconds
  debounceDelay: number // Debounce delay for change detection
  onAutoSave: (data: TicketFormData) => Promise<void>
  onError: (error: Error) => void
  enabled: boolean
  ticketId?: string
}
```

**Usage:**
```typescript
const autoSave = useAutoSave(formData, {
  interval: 30000, // 30 seconds
  debounceDelay: 1000, // 1 second
  onAutoSave: handleAutoSave,
  onError: handleAutoSaveError,
  enabled: autoSaveEnabled && mode === 'edit',
  ticketId
})
```

### 2. Auto-Save Status Components (`/components/ui/auto-save-status.tsx`)

Visual components for displaying auto-save status:

- `AutoSaveStatus`: Full status display with icon and text
- `AutoSaveStatusBadge`: Badge-style status indicator
- `AutoSaveIndicator`: Minimal dot indicator

**Status Types:**
- `idle`: No activity
- `saving`: Currently saving
- `saved`: Successfully saved
- `error`: Save failed
- `conflict`: Conflict detected

### 3. Enhanced TicketService (`/lib/services/ticketService.ts`)

Extended service methods for auto-save operations:

- `autoSave()`: Optimized for frequent auto-save calls
- `getAutoSavedDraft()`: Retrieve most recent saved draft
- `clearAllSavedDrafts()`: Clean up localStorage
- `checkForConflicts()`: Detect server-side conflicts

### 4. Enhanced Form Components

**TicketFormComponent** (`/components/forms/TicketFormComponent.tsx`):
- Integrated auto-save hook
- Local backup restoration alerts
- Manual save triggers
- Status indicators in header and footer

**Edit Page** (`/app/tickets/[id]/edit/page.tsx`):
- Auto-save configuration
- Error handling
- Form change tracking

## Features

### 1. Automatic Saving

- **Timer-based**: Saves every 30 seconds when changes are detected
- **Change detection**: Uses debounced form watching to detect modifications
- **Conflict prevention**: Avoids saving during manual operations

### 2. Local Storage Backup

- **Offline support**: Saves form data to localStorage as backup
- **Recovery**: Prompts to restore unsaved work on page reload
- **Expiration**: Automatically cleans up old backups (1 hour)

### 3. Status Indicators

- **Visual feedback**: Clear status with icons and text
- **Timestamps**: Shows when data was last saved
- **Error states**: Indicates save failures with retry options

### 4. Conflict Resolution

- **Server sync**: Detects when data has changed on server
- **User choice**: Allows selection between local and server versions
- **Merge strategies**: Supports field-level conflict resolution

### 5. Manual Override

- **Save now button**: Immediate save without waiting for timer
- **Draft save**: Traditional save draft functionality
- **Disable option**: Can turn off auto-save if needed

## Implementation Details

### Data Flow

1. **Form Changes**: Form data changes trigger debounced change detection
2. **Change Detection**: Hook compares current vs. previous data using deep equality
3. **Timer Trigger**: 30-second interval checks for unsaved changes
4. **Auto-Save**: Calls `TicketService.autoSave()` with silent error handling
5. **Local Backup**: Simultaneously saves to localStorage
6. **Status Update**: Updates visual indicators based on save result

### Error Handling

- **Silent failures**: Auto-save errors don't interrupt user workflow
- **Local backup**: Always maintains localStorage backup even if server save fails
- **Retry mechanism**: Manual save button provides immediate retry option
- **Network awareness**: Gracefully handles offline/online transitions

### Performance Optimizations

- **Debouncing**: Prevents excessive API calls during rapid typing
- **Change detection**: Only saves when actual changes are detected
- **Selective saves**: Only sends modified fields to reduce payload
- **Timer management**: Proper cleanup prevents memory leaks

## Usage Guidelines

### For Edit Mode

Auto-save is automatically enabled for edit mode with these features:

```typescript
<TicketFormComponent
  mode="edit"
  ticketId={ticketId}
  autoSaveEnabled={true}
  onAutoSaveError={handleAutoSaveError}
  onFormChange={handleFormChange}
  // ... other props
/>
```

### For Create Mode

Create mode uses localStorage backup without server auto-save:

```typescript
<TicketFormComponent
  mode="create"
  autoSaveEnabled={false} // Uses localStorage only
  // ... other props
/>
```

### Status Monitoring

Monitor auto-save status in your components:

```typescript
const { status, lastSaved, hasUnsavedChanges } = autoSave

// Show status indicator
<AutoSaveStatus
  status={status}
  lastSaved={lastSaved}
  size="sm"
/>

// Conditional UI based on save state
{hasUnsavedChanges && (
  <Button onClick={triggerAutoSave}>
    Save Now
  </Button>
)}
```

## Configuration

### Auto-Save Intervals

```typescript
// Default configuration
const config = {
  interval: 30000,      // 30 seconds
  debounceDelay: 1000,  // 1 second
  enabled: true
}

// For high-frequency editing
const fastConfig = {
  interval: 10000,      // 10 seconds
  debounceDelay: 500,   // 500ms
  enabled: true
}
```

### Local Storage Keys

- `ticket-autosave-{ticketId}`: Edit mode auto-save
- `ticket-autosave-new`: Create mode auto-save
- `ticket-create-draft`: Manual draft saves (legacy)

## Testing

The auto-save functionality includes comprehensive tests:

- Unit tests for the `useAutoSave` hook
- Integration tests for form components
- Mocked localStorage operations
- Error scenario testing

Run tests with:
```bash
npm test -- auto-save
```

## Browser Support

- **Modern browsers**: Full functionality with localStorage support
- **Older browsers**: Graceful degradation without auto-save
- **Mobile browsers**: Optimized for touch interfaces

## Security Considerations

- **Data privacy**: Auto-save data remains in localStorage only
- **Cleanup**: Automatic expiration prevents data accumulation
- **No credentials**: Never auto-saves sensitive authentication data

## Performance Impact

- **Minimal overhead**: Debouncing prevents excessive operations
- **Async operations**: Non-blocking save operations
- **Memory efficient**: Proper cleanup and timer management
- **Network friendly**: Optimized payload sizes

## Future Enhancements

- **Server-side auto-save endpoints**: Dedicated lightweight save API
- **Collaborative editing**: Real-time conflict detection
- **Smart intervals**: Adaptive save frequency based on user activity
- **Cloud sync**: Cross-device draft synchronization
- **Advanced conflict resolution**: Automatic merge strategies