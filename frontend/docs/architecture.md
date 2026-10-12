# Frontend Architecture

This SPA is a React 19, TypeScript, Vite 7 CRM frontend. It uses React Router 7 for navigation, TanStack Query v5 for server state, Redux Toolkit for auth-only app state, Axios for HTTP, Radix-style UI primitives, Tailwind CSS v4, React Hook Form, and Zod contracts shared with the backend.

## Runtime Flow

```tsx
// src/main.tsx
<Providers>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</Providers>
```

`Providers` wires Redux, TanStack Query, theme support, and React Query Devtools in development. `App` bootstraps auth, wraps routes in `ErrorBoundary`, `Suspense`, and `TooltipProvider`, then renders `AppRoutes`.

## Layers

| Layer | Current paths | Responsibility |
| --- | --- | --- |
| App shell | `src/app/*` | `queryClient`, Redux store, interceptor setup, providers, toast listener middleware |
| Routing | `src/components/routing/*`, `src/components/guards/*`, `src/pages/*` | Route declarations, auth guards, role guards, thin page wrappers |
| Features | `src/features/<feature>/*` | Domain API services, hooks, views, forms, tables, validators, types, constants |
| Shared UI | `src/components/common/*`, `src/components/ui/*`, `src/components/layout/*` | Reusable primitives, layout, table, dialogs, loading/empty/error states |
| API client | `src/lib/api/*`, `src/lib/queryKeys.ts` | Axios instance, auth/token interceptors, service helper, query key factory |
| Contracts | `src/contracts/*` | Backend-aligned DTOs, constants, and Zod validation schemas |
| Utilities | `src/hooks/*`, `src/utils/*`, `src/types/*`, `src/constants/*` | Cross-feature hooks, helpers, global types, app constants |

## Current Feature Modules

`announcements`, `audit`, `auth`, `billing`, `customers`, `dashboard`, `help`, `items`, `leads`, `notifications`, `organizations`, `platformSettings`, `prospects`, `quotations`, `reports`, and `users`.

Auth is the only feature with Redux state. All other feature data is server state handled by TanStack Query.

## Routing Model

Routes live in `src/components/routing/AppRoutes.tsx`.

- Public routes: `/` renders `AuthEntryRoute`, `/signup` renders self-service signup, `/forgot-password` renders the OTP reset flow.
- Protected tenant routes: `/dashboard`, `/users`, `/items`, `/leads`, `/prospects`, `/customers`, `/quotations`, `/reports`, `/audit-logs`, `/announcements`, `/notifications`, `/settings`, `/help`, and `/profile`. Follow-ups have no page of their own; they live on the prospect detail view.
- Platform routes: `/platform/organizations`, `/platform/settings`, `/platform/billing`, and nested `/platform/organizations/:slug/*` tenant workspace routes.
- Legacy redirects remain for old `/:orgSlug/*`, `/super-admin/*`, and `/admin/*` URLs.

Route access is driven by role arrays in `src/constants/roles.ts`. `ProtectedRoute` only checks that a user exists. `RoleGuard` handles role-level redirects.

## Data Flow

```text
View component
  -> feature hook
  -> feature API service
  -> src/lib/api/client.ts
  -> src/lib/api/interceptors.ts
  -> backend /api/v1
  -> TanStack Query cache
```

Feature views should call hooks, not Axios directly. Services own endpoint calls and response unwrapping. Hooks own cache keys, mutation invalidation, and API toasts.

## Auth And Tenant Context

The session is an in-memory access token plus an HTTP-only refresh cookie; the interceptor attaches auth, CSRF, and (for super admin workspaces) `x-organization-id` headers. Full flow: [frontend-auth.md](frontend-auth.md).

## Where To Add Things

See the placement rules in [folder-structure.md](folder-structure.md#placement-rules).
