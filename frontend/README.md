# CRM Frontend

React single-page app for the CRM. It talks only to the backend's `/api/v1` API.

## Stack

- React 19, TypeScript, Vite 7, React Router 7.
- TanStack Query v5 for all server state; Redux Toolkit for auth state only.
- Axios (one shared client with auth, CSRF, and tenant interceptors).
- React Hook Form + Zod, with contracts mirrored from the backend in `src/contracts`.
- Tailwind CSS v4, Radix UI primitives, Lucide icons, Recharts, TanStack Table, Sonner toasts.

## Quick Start

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, expects the backend on :5000
```

Environment, commands, and the PR checklist: [docs/development-workflow.md](docs/development-workflow.md).

## Layout

```text
src/
|-- app/          providers, Redux store, query client
|-- components/   shared UI: ui primitives, common, layout, guards, routing
|-- constants/    roles, enums, labels, pagination
|-- contracts/    backend-aligned types, constants, Zod schemas
|-- features/     one folder per domain (api, hooks, components, ...)
|-- hooks/        cross-feature hooks (useListView, useFilters, ...)
|-- lib/          Axios client, interceptors, token store, query keys
|-- pages/        thin route wrappers
|-- types/        app-wide types
`-- utils/        helpers (apiError, formatting, ...)
```

## Docs

Read in this order:

1. [architecture.md](docs/architecture.md) — runtime flow, layers, routing, data flow
2. [folder-structure.md](docs/folder-structure.md) — tree and placement rules
3. [architecture-api-layer.md](docs/architecture-api-layer.md) — Axios client, interceptors, services, query/mutation patterns
4. [frontend-auth.md](docs/frontend-auth.md) — session model, bootstrap, refresh, guards
5. [state-management.md](docs/state-management.md) — what lives in Redux, Query, URL, and local state
6. [component-guidelines.md](docs/component-guidelines.md) — component roles, shared components, forms, styling
7. [error-handling.md](docs/error-handling.md) — error normalization and UI states
8. [coding-guidelines.md](docs/coding-guidelines.md) — TypeScript, imports, naming
9. [development-workflow.md](docs/development-workflow.md) — setup, env, commands, PR checklist

Backend API reference: [backend/docs/api-spec.md](../backend/docs/api-spec.md).
