---
sidebar_position: 17
title: "Component Patterns"
description: "Shared component library: DataTable, SearchableSelect, CustomFieldRenderer, and other reusable components"
---

# Component Patterns

The frontend includes a shared component library in `apps/web/src/components/shared/`. These components are designed for reuse across all feature modules.

## DataTable

The primary table component used on all list pages. Supports sortable columns, pagination, column resizing, column visibility preferences, and row actions.

**Location:** `apps/web/src/components/shared/data-table/DataTable.tsx`

```tsx
import { DataTable } from '../components/shared/data-table/DataTable';

function LeadsPage() {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const { columns } = useTableColumns('leads');
  const { preferences, updateColumnWidth } = useTablePreferences('leads');

  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      preferences={preferences}
      onPageChange={(page) => fetchData({ page })}
      onSort={(column, direction) => fetchData({ sortBy: column, sortDir: direction })}
      onColumnResize={updateColumnWidth}
      actions={(row) => (
        <div className="flex gap-1">
          <button onClick={() => navigate(`/leads/${row.id}`)}>View</button>
          <button onClick={() => handleDelete(row.id)}>Delete</button>
        </div>
      )}
      loading={loading}
      emptyMessage="No leads found"
    />
  );
}
```

### DataTable Props

| Prop | Type | Description |
|------|------|-------------|
| `columns` | `Column[]` | Column definitions (name, label, width, sortable) |
| `data` | `any[]` | Row data array |
| `meta` | `PaginationMeta` | Pagination info (total, page, limit, totalPages) |
| `preferences` | `TablePreference` | User column preferences |
| `onPageChange` | `(page: number) => void` | Page change handler |
| `onSort` | `(column: string, dir: string) => void` | Sort handler |
| `onColumnResize` | `(column: string, width: number) => void` | Column resize handler |
| `actions` | `(row: any) => ReactNode` | Row action buttons renderer |
| `loading` | `boolean` | Shows loading skeleton |
| `emptyMessage` | `string` | Message when no data |
| `selectable` | `boolean` | Enable row selection checkboxes |
| `onSelectionChange` | `(ids: string[]) => void` | Selection change handler |

### useTableColumns Hook

```typescript
const { columns, loading } = useTableColumns('leads');
// Returns column definitions configured for the 'leads' module
```

### useTablePreferences Hook

```typescript
const {
  preferences,           // Current user preferences
  updateColumnVisibility, // Toggle column visibility
  updateColumnWidth,      // Resize column
  updateSortOrder,       // Change default sort
  resetToDefault,        // Reset all preferences
} = useTablePreferences('leads');
```

## SearchableSelect

A dropdown select component with built-in search, supporting single and multi-select modes.

**Location:** `apps/web/src/components/shared/SearchableSelect.tsx`

```tsx
import { SearchableSelect } from '../components/shared/SearchableSelect';

// Single select
<SearchableSelect
  label="Assigned To"
  options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
  value={selectedUserId}
  onChange={setSelectedUserId}
  placeholder="Select a user..."
  searchable
/>

// Multi-select
<SearchableSelect
  label="Teams"
  options={teams.map(t => ({ value: t.id, label: t.name }))}
  value={selectedTeamIds}
  onChange={setSelectedTeamIds}
  multiple
  placeholder="Select teams..."
/>
```

### SearchableSelect Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Field label |
| `options` | `{ value: string; label: string }[]` | Available options |
| `value` | `string \| string[]` | Selected value(s) |
| `onChange` | `(value: any) => void` | Change handler |
| `multiple` | `boolean` | Enable multi-select |
| `searchable` | `boolean` | Enable search filtering |
| `placeholder` | `string` | Placeholder text |
| `disabled` | `boolean` | Disable the input |
| `error` | `string` | Error message to display |

## CustomFieldRenderer

Dynamically renders form fields based on their configured type (text, number, date, select, multi-select, checkbox, textarea, etc.).

**Location:** `apps/web/src/components/shared/CustomFieldRenderer.tsx`

```tsx
import { CustomFieldRenderer } from '../components/shared/CustomFieldRenderer';

// Render a custom field
<CustomFieldRenderer
  field={{
    name: 'budget_range',
    label: 'Budget Range',
    type: 'select',
    required: true,
    options: ['< $10K', '$10K - $50K', '$50K - $100K', '> $100K'],
  }}
  value={formData.budget_range}
  onChange={(value) => setFormData({ ...formData, budget_range: value })}
  permission="editable"  // 'editable' | 'read_only' | 'hidden'
/>
```

### Supported Field Types

| Type | Rendered As |
|------|------------|
| `text` | Text input |
| `number` | Number input |
| `date` | Date picker |
| `datetime` | Date-time picker |
| `email` | Email input |
| `phone` | Phone input |
| `url` | URL input |
| `textarea` | Multi-line textarea |
| `select` | Dropdown select |
| `multi_select` | Multi-select with tags |
| `checkbox` | Checkbox |
| `currency` | Currency input with symbol |
| `percentage` | Percentage input |
| `user_lookup` | User selector (SearchableSelect) |

## NotesPanel

Displays and manages notes for any entity. Includes note creation form and note list with timestamps.

**Location:** `apps/web/src/components/shared/NotesPanel.tsx`

```tsx
import { NotesPanel } from '../components/shared/NotesPanel';

<NotesPanel
  entityType="leads"
  entityId={leadId}
/>
```

## DocumentsPanel

Manages documents/files attached to any entity. Supports upload, download, and delete.

**Location:** `apps/web/src/components/shared/DocumentsPanel.tsx`

```tsx
import { DocumentsPanel } from '../components/shared/DocumentsPanel';

<DocumentsPanel
  entityType="leads"
  entityId={leadId}
  canUpload={canEdit}
  canDelete={canDelete}
/>
```

## AvatarUpload

Profile image upload component with preview and crop.

**Location:** `apps/web/src/components/shared/AvatarUpload.tsx`

```tsx
import { AvatarUpload } from '../components/shared/AvatarUpload';

<AvatarUpload
  currentAvatar={user.avatar}
  onUpload={(url) => handleAvatarChange(url)}
  size="lg"  // 'sm' | 'md' | 'lg'
/>
```

## Timeline

Displays an activity timeline for an entity (calls, emails, meetings, stage changes, etc.).

```tsx
<Timeline
  entityType="leads"
  entityId={leadId}
/>
```

## ChangeHistory

Shows the audit log as a chronological timeline of changes.

```tsx
<ChangeHistory
  entityType="leads"
  entityId={leadId}
/>
```

## StageFieldInput

Modal component that appears during stage transitions when the target stage has required fields.

```tsx
<StageFieldInput
  stageId={targetStageId}
  fields={requiredFields}
  onSubmit={(fieldValues) => handleStageChange(targetStageId, fieldValues)}
  onCancel={() => setShowModal(false)}
/>
```

## Building New Shared Components

When creating new shared components, follow these conventions:

### File Structure

```
components/shared/
└── MyComponent.tsx
```

### Component Template

```tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

interface MyComponentProps {
  title: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

export function MyComponent({ title, loading, error, onRetry, children }: MyComponentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200
                    dark:border-slate-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
```

:::tip Checklist for New Components
- Include TypeScript props interface
- Support dark mode (`dark:` variants)
- Handle loading state with `<Loader2 className="animate-spin" />`
- Handle error state with retry option
- Use Tailwind classes only (no inline styles)
- Use `rounded-xl` for buttons and cards
- Use `purple-600` as the primary action color
:::
