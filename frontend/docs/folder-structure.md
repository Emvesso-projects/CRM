# Folder Structure

## Current `src` Roots

```text
frontend/src/
|-- app/
|-- assets/
|-- components/
|-- constants/
|-- contracts/
|-- features/
|-- hooks/
|-- lib/
|-- pages/
|-- types/
`-- utils/
```

## Important Folders

```text
app/
|-- providers.tsx
|-- queryClient.ts
|-- toastListenerMiddleware.ts
`-- store/
    |-- index.ts
    `-- types.ts

components/
|-- common/
|-- guards/
|-- layout/
|-- routing/
`-- ui/

lib/
|-- queryKeys.ts
`-- api/
    |-- auth.ts
    |-- client.ts
    |-- interceptors.ts
    |-- service.utils.ts
    `-- tokenStore.ts
```

## Feature Modules

Current feature folders:

```text
features/
|-- announcements/
|-- audit/
|-- auth/
|-- billing/
|-- customers/
|-- dashboard/
|-- help/
|-- items/
|-- leads/
|-- notifications/
|-- organizations/
|-- platformSettings/
|-- prospects/
|-- quotations/
|-- reports/
`-- users/
```

Common feature shape:

```text
features/<feature>/
|-- api/
|   |-- endpoints.ts
|   `-- services.ts
|-- components/
|   |-- view/
|   |-- forms/
|   |-- table/
|   |-- details/
|   `-- shared/
|-- constants/
|-- hooks/
|-- types/
|-- validators/
`-- index.ts
```

Not every feature has every folder. Follow the local pattern already present.

## Auth Feature Shape

```text
features/auth/
|-- api/
|   |-- endpoints.ts
|   `-- services.ts
|-- components/
|   |-- forms/
|   `-- view/
|-- hooks/
|   |-- useAuth.ts
|   |-- useAuthBootstrap.ts
|   `-- usePermissions.ts
|-- store/
|   |-- selectors.ts
|   `-- slice.ts
|-- types/
`-- index.ts
```

Auth is the only feature with a `store` folder.

## Contracts

```text
contracts/
|-- constants/
|-- dashboard/
|-- types/
`-- validation/
```

These mirror backend contracts and should stay aligned with backend API changes.

## Placement Rules

This is the single placement table; other docs link here.

| What you are adding | Location |
| --- | --- |
| New route screen | `src/pages/<Name>Page.tsx` (thin wrapper) plus `features/<feature>/components/view/*`; register it in `components/routing/AppRoutes.tsx` |
| Route guard or routing helper | `components/guards/*`, `components/routing/*` |
| App shell layout | `components/layout/*` |
| Base UI primitive | `components/ui/*` |
| UI used by multiple features | `components/common/*` |
| Feature-only UI (forms, tables, details) | `features/<feature>/components/*` |
| API path constants | `features/<feature>/api/endpoints.ts` |
| API call implementation | `features/<feature>/api/services.ts` |
| Server-state hook (query/mutation) | `features/<feature>/hooks/*` |
| Shared list/search/filter behavior | `src/hooks/useListView.ts`, `src/hooks/useFilters.ts`, table components |
| Other cross-feature hook | `src/hooks/*` |
| Global utility | `src/utils/*` |
| Backend-aligned DTO, schema, or constant | `src/contracts/types/*`, `src/contracts/validation/*`, `src/contracts/constants/*` |
