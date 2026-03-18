---
sidebar_position: 16
title: "API Layer"
description: "Frontend API architecture: axios instance, interceptors, module API files, and standard patterns"
---

# API Layer

The frontend communicates with the backend through a centralized API layer built on Axios. Each module has its own API file exporting a typed object with all endpoint methods.

## Axios Instance

The canonical axios instance is defined in `apps/web/src/api/contacts.api.ts` and imported by all other API files:

```typescript
// apps/web/src/api/contacts.api.ts
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          { refreshToken },
        );

        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
```

:::warning Single Source of Truth
Always import `api` from `contacts.api.ts`. Never create additional axios instances. This ensures consistent token handling and error interception across all modules.

```typescript
// CORRECT
import { api } from './contacts.api';

// WRONG — bypasses interceptors
import axios from 'axios';
const api = axios.create({ baseURL: '...' });
```
:::

## API File Pattern

Each module has its own API file that exports an object with methods for every endpoint:

```typescript
// apps/web/src/api/my-module.api.ts
import { api } from './contacts.api';

export const myModuleApi = {
  // List with pagination and filters
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const { data } = await api.get('/my-module', { params });
    return data;
  },

  // Get single record
  getById: async (id: string) => {
    const { data } = await api.get(`/my-module/${id}`);
    return data;
  },

  // Create
  create: async (body: CreateMyModuleDto) => {
    const { data } = await api.post('/my-module', body);
    return data;
  },

  // Update
  update: async (id: string, body: Partial<CreateMyModuleDto>) => {
    const { data } = await api.put(`/my-module/${id}`, body);
    return data;
  },

  // Delete
  delete: async (id: string) => {
    await api.delete(`/my-module/${id}`);
  },

  // Module-specific endpoints
  getStats: async () => {
    const { data } = await api.get('/my-module/stats');
    return data;
  },
};
```

## Complete API File Reference

| File | Exports | Path |
|------|---------|------|
| `contacts.api.ts` | `api` (shared instance), `contactsApi` | `apps/web/src/api/contacts.api.ts` |
| `accounts.api.ts` | `accountsApi` | `apps/web/src/api/accounts.api.ts` |
| `leads.api.ts` | `leadsApi`, `leadSettingsApi` | `apps/web/src/api/leads.api.ts` |
| `opportunities.api.ts` | `opportunitiesApi`, `opportunitySettingsApi` | `apps/web/src/api/opportunities.api.ts` |
| `tasks.api.ts` | `tasksApi` | `apps/web/src/api/tasks.api.ts` |
| `products.api.ts` | `productsApi` | `apps/web/src/api/products.api.ts` |
| `users.api.ts` | `usersApi` | `apps/web/src/api/users.api.ts` |
| `roles.api.ts` | `rolesApi` | `apps/web/src/api/roles.api.ts` |
| `teams.api.ts` | `teamsApi` | `apps/web/src/api/teams.api.ts` |
| `departments.api.ts` | `departmentsApi` | `apps/web/src/api/departments.api.ts` |
| `targets.api.ts` | `targetsApi`, `gamificationApi` | `apps/web/src/api/targets.api.ts` |
| `reports.api.ts` | `reportsApi` | `apps/web/src/api/reports.api.ts` |
| `admin.api.ts` | `adminApi` | `apps/web/src/api/admin.api.ts` |
| `notifications.api.ts` | `notificationsApi` | `apps/web/src/api/notifications.api.ts` |
| `upload.api.ts` | `uploadApi` | `apps/web/src/api/upload.api.ts` |
| `calendar-sync.api.ts` | `calendarSyncApi` | `apps/web/src/api/calendar-sync.api.ts` |
| `lead-import.api.ts` | `leadImportApi` | `apps/web/src/api/lead-import.api.ts` |
| `page-layout.api.ts` | `pageLayoutApi` | `apps/web/src/api/page-layout.api.ts` |
| `tablePreferences.api.ts` | `tableApi` | `apps/web/src/api/tablePreferences.api.ts` |
| `module-settings.api.ts` | `moduleSettingsApi` | `apps/web/src/api/module-settings.api.ts` |

## Error Handling

### API Error Structure

Backend errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": ["Email is required", "Name must be at least 2 characters"]
}
```

### Handling Errors in Components

```typescript
import { AxiosError } from 'axios';

async function handleSubmit(data: any) {
  try {
    await leadsApi.create(data);
    toast.success('Lead created successfully');
  } catch (err) {
    const error = err as AxiosError<{ message: string; details?: string[] }>;

    if (error.response?.status === 409) {
      toast.error('A lead with this email already exists');
    } else if (error.response?.data?.details) {
      error.response.data.details.forEach((msg) => toast.error(msg));
    } else {
      toast.error(error.response?.data?.message || 'Something went wrong');
    }
  }
}
```

## Request/Response Patterns

### Pagination

All list endpoints return paginated responses:

```typescript
// Request
const result = await leadsApi.getAll({ page: 2, limit: 25, search: 'acme' });

// Response
{
  "data": [
    { "id": "uuid-1", "firstName": "John", ... },
    { "id": "uuid-2", "firstName": "Jane", ... }
  ],
  "meta": {
    "total": 150,
    "page": 2,
    "limit": 25,
    "totalPages": 6
  }
}
```

### File Upload

```typescript
// upload.api.ts
export const uploadApi = {
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  uploadDocument: async (file: File, entityType: string, entityId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    const { data } = await api.post('/upload/document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
```

## Adding a New API File

1. Create `apps/web/src/api/my-module.api.ts`
2. Import the shared `api` instance from `contacts.api.ts`
3. Export a named object with all endpoint methods
4. Import and use in your feature components

```typescript
// my-module.api.ts
import { api } from './contacts.api';

export const myModuleApi = {
  getAll: async (params?: any) => {
    const { data } = await api.get('/my-module', { params });
    return data;
  },
  // ... other methods
};
```

:::tip Naming Convention
The export name follows the pattern `{moduleName}Api`:
- `leadsApi`, `contactsApi`, `usersApi`
- For modules with settings: `leadSettingsApi`, `opportunitySettingsApi`
:::
