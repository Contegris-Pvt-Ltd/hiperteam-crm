---
sidebar_position: 14
title: "Frontend Overview"
description: "React frontend architecture, design system, component conventions, and build setup"
---

# Frontend Overview

The Intellicon CRM frontend is a React single-page application (SPA) built with TypeScript, Vite, and Tailwind CSS.

## Technology Stack

| Technology | Purpose |
|-----------|---------|
| **React 18** | UI component library |
| **TypeScript** | Type safety |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Utility-first styling |
| **Zustand** | Lightweight state management |
| **Axios** | HTTP client with interceptors |
| **React Router** | Client-side routing |
| **Lucide React** | Icon library |
| **Recharts** | Dashboard charts and visualizations |

## Build and Development

### Development Server

```bash
cd apps/web
npm run dev
# Starts on http://localhost:5173
```

### Production Build

```bash
cd apps/web
npm run build
# Output in apps/web/dist/
```

### Type Checking

```bash
cd apps/web
npm run type-check
# OR
npx tsc --noEmit
```

## Project Structure

```
apps/web/src/
├── App.tsx              ← Route definitions
├── main.tsx             ← Entry point
├── index.css            ← Tailwind imports
├── api/                 ← API layer (one file per module)
├── components/          ← Shared + layout components
├── features/            ← Feature pages (organized by module)
├── hooks/               ← Custom React hooks
├── stores/              ← Zustand state stores
├── config/              ← Constants and configuration
└── utils/               ← Utility functions
```

## Design System

### Color Palette

| Purpose | Light Mode | Dark Mode |
|---------|-----------|-----------|
| **Primary** | `purple-600` | `purple-500` |
| **Primary Hover** | `purple-700` | `purple-600` |
| **Success** | `green-600` | `green-500` |
| **Danger** | `red-600` | `red-500` |
| **Warning** | `amber-500` | `amber-400` |
| **Info** | `blue-600` | `blue-500` |
| **Background** | `white` / `gray-50` | `slate-900` / `slate-800` |
| **Card** | `white` | `slate-800` |
| **Border** | `gray-200` | `slate-700` |
| **Text Primary** | `gray-900` | `white` |
| **Text Secondary** | `gray-500` | `gray-400` |

### Component Conventions

#### Buttons

```tsx
// Primary button
<button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl
                   transition-colors duration-200">
  Save
</button>

// Secondary button
<button className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600
                   text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl">
  Cancel
</button>

// Danger button
<button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl">
  Delete
</button>
```

#### Cards

```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200
                dark:border-slate-700 p-6 shadow-sm">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
    Card Title
  </h3>
  <p className="text-gray-500 dark:text-gray-400 mt-2">
    Card content
  </p>
</div>
```

#### Form Inputs

```tsx
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600
             rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white
             focus:ring-2 focus:ring-purple-500 focus:border-transparent"
  placeholder="Enter value..."
/>
```

#### Loading States

```tsx
import { Loader2 } from 'lucide-react';

// Loading spinner
<div className="flex items-center justify-center py-12">
  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
</div>

// Button loading state
<button disabled className="bg-purple-600 text-white px-4 py-2 rounded-xl opacity-75">
  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
  Saving...
</button>
```

#### Error States

```tsx
// Error with retry
<div className="text-center py-12">
  <p className="text-red-600 dark:text-red-400 mb-4">
    Failed to load data. Please try again.
  </p>
  <button
    onClick={refetch}
    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl"
  >
    Retry
  </button>
</div>
```

:::tip Always Include Both Modes
Every Tailwind class that sets a color must include its `dark:` variant. The app supports both light and dark modes.

```tsx
// CORRECT
<div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-white">

// WRONG — no dark mode support
<div className="bg-white text-gray-900">
```
:::

### Typography

```tsx
// Page title
<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Page Title</h1>

// Section title
<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Section</h2>

// Body text
<p className="text-sm text-gray-600 dark:text-gray-400">Body text</p>

// Muted text
<span className="text-xs text-gray-400 dark:text-gray-500">Timestamp</span>
```

### Spacing and Layout

```tsx
// Page layout
<div className="p-6 space-y-6">
  <div className="flex items-center justify-between">
    <h1>Title</h1>
    <button>Action</button>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {/* Cards */}
  </div>
</div>
```

## Responsive Design

The application uses Tailwind's responsive prefixes:

| Prefix | Breakpoint | Use Case |
|--------|-----------|----------|
| (none) | `< 640px` | Mobile |
| `sm:` | `>= 640px` | Large mobile |
| `md:` | `>= 768px` | Tablet |
| `lg:` | `>= 1024px` | Desktop |
| `xl:` | `>= 1280px` | Large desktop |

```tsx
// Responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Hide on mobile
<div className="hidden md:block">Desktop only</div>

// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row gap-4">
```

## State Management

### Zustand Stores

```typescript
// stores/auth.store.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  setAuth: (user, accessToken, refreshToken) =>
    set({ user, accessToken, refreshToken }),
  logout: () =>
    set({ user: null, accessToken: null, refreshToken: null }),
}));
```

```typescript
// stores/sidebar.store.ts
interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  setMobileOpen: (open: boolean) => void;
}
```

### Using Stores in Components

```tsx
import { useAuthStore } from '../stores/auth.store';

function UserProfile() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div>
      <span>{user?.firstName} {user?.lastName}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

:::note Zustand vs Context
Zustand was chosen over React Context for its simpler API, built-in selector optimization (re-renders only when selected state changes), and no need for Provider wrappers.
:::
