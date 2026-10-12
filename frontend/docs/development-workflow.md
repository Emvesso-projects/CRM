# Development Workflow

## Prerequisites

- Node.js 20 or newer, npm.
- The backend running locally for API-backed screens (see [backend/docs/development-workflow.md](../../backend/docs/development-workflow.md)).

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Vite runs on `http://localhost:5173`. Open it and confirm the login page renders, then log in and check that `/auth/login`, `/auth/me`, and feature calls go to the expected base URL.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Production yes, development optional | Full backend API base URL including `/api/v1` |

In development, `src/lib/api/client.ts` falls back to `http://localhost:5000/api/v1`, so create `frontend/.env.development` only to point somewhere else:

```bash
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Only variables prefixed with `VITE_` are exposed to frontend code. Feature endpoint constants stay relative to this base (`"/users"`, never `"/api/v1/users"`).

## Commands

```bash
npm run dev       # Vite dev server
npm run lint      # ESLint
npm run build     # tsc -b && vite build
npm run preview   # serve the production build locally
```

## Feature Delivery Order

1. Confirm backend contract or add/update `src/contracts/*`.
2. Add endpoint constants in `features/<feature>/api/endpoints.ts`.
3. Implement service calls in `features/<feature>/api/services.ts`.
4. Add or update query/mutation hooks in `features/<feature>/hooks/*`.
5. Build feature UI in `features/<feature>/components/*`.
6. Add a thin page wrapper in `src/pages/*` if a new route is needed.
7. Register the route and role guard in `AppRoutes.tsx`.
8. Update the owning doc when API, auth, routing, or folder conventions change.

## PR Checklist

- `npm run lint` and `npm run build` pass.
- API calls use the shared client and endpoint constants — no raw `fetch()`, extra Axios instances, or hardcoded full URLs.
- Query keys come from `src/lib/queryKeys.ts`; mutations invalidate the relevant queries.
- Server state uses TanStack Query; auth behavior stays in `features/auth/store/*`.
- Loading, empty, error, and pending states are covered, and the change was exercised in the browser.
- Role guard and sidebar changes are aligned for new routes.
- No secrets, tokens, or passwords are logged.

Commit style and the PR template are in the root [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Common Issues

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Missing VITE_API_BASE_URL` in production | No production env var set | Set `VITE_API_BASE_URL` during build/deploy |
| API `Network Error` | Backend not running or wrong base URL | Check backend port and `VITE_API_BASE_URL` |
| Cookies not sent on refresh/logout | Missing credentials/CORS setup | Keep Axios `withCredentials: true` and backend CORS `credentials: true` |
| 403 CSRF on writes | Missing write header | Use the shared Axios client so the interceptor adds `x-requested-with` |
