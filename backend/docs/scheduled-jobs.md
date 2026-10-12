# Scheduled Jobs — Setup & Architecture

The CRM runs background work in three ways:
1. **In-Process Scheduler (`node-cron` v4 + Luxon)**: runs the two follow-up jobs every minute (`* * * * *`). Standard for single-instance deployments, VPS (PM2), and local development.
2. **External Trigger Endpoint (`POST /api/v1/internal/jobs/run`)**: runs any registered job on demand. Required for `subscription-warnings` and `audit-retention`, which the in-process scheduler does not run, and for follow-ups when running multiple replicas (Render Cron, GitHub Actions, AWS EventBridge, system cron).
3. **Token cleanup interval**: a `setInterval` started in `src/index.ts`, independent of both of the above.

---

## 1. In-Process Scheduler (Production Default on VPS / PM2)

### Architecture
- **Engine**: `node-cron` (v4 with native TypeScript definitions).
- **Cadence**: Runs every minute (`* * * * *`) configured via `SCHEDULER_CRON_EXPRESSION`.
- **Startup Sweep**: Immediately executes a catch-up sweep (`trigger: "startup"`) on server boot to catch any notifications missed during downtime or server restarts.
- **Concurrency & Overlap Guard**:
  - `noOverlap: true` configured on `node-cron`.
  - In-process `isExecuting` mutex ensures startup sweep and cron triggers never run concurrently.
  - Event hooks `execution:overlap` and `execution:missed` log diagnostic warnings.
- **Graceful Shutdown**: Calls `scheduler.stop()` on `SIGTERM` and `SIGINT` before closing DB connections and HTTP listeners.

### Environment Configuration
Configure these in `backend/.env.development` / `backend/.env.production` (selected by `NODE_ENV`):
```env
# Background Scheduler & Timezone
APP_TIMEZONE="Asia/Kolkata"
ENABLE_IN_PROCESS_SCHEDULER=true
SCHEDULER_CRON_EXPRESSION="* * * * *"
```

- `APP_TIMEZONE`: Timezone used by Luxon for parsing business schedule dates and formatting notification labels (defaults to `Asia/Kolkata`).
- `ENABLE_IN_PROCESS_SCHEDULER`: Set to `true` (default) to run the in-process cron. Set to `false` if using an external cron runner across multiple replicas.
- `SCHEDULER_CRON_EXPRESSION`: Cron expression (defaults to `* * * * *` = every minute).

---

## 2. Timezone Resolution (3 Layers)

1. **`node-cron` timezone**: Wall clock for cron triggering (set to `APP_TIMEZONE`).
2. **`Luxon` timezone (`APP_TIMEZONE`)**: Converts scheduled date string and optional `HH:mm` time string into an exact, absolute moment in UTC (`resolveDueAt`).
3. **`PostgreSQL` (`TIMESTAMPTZ` / UTC)**: Source of truth against which `now` is compared.

---

## 3. Boundary & Deduplication Rules

| Event Type | Active Condition | Dedupe Key Format |
|---|---|---|
| **Follow-Up Reminder** | `now >= remindAt && now < dueAt` | `FOLLOW_UP_DUE:${row.id}:${dueAt.toISOString()}` |
| **Follow-Up Overdue** | `now >= dueAt && dueAt >= windowStart` | `FOLLOW_UP_OVERDUE:${row.id}:${dueAt.toISOString()}` |

- **No Gap, No Collision**: When `now < dueAt`, only the reminder job can fire. The very moment `now >= dueAt`, the overdue job takes over.
- **Distinct Dedupe Keys**: `FOLLOW_UP_DUE` and `FOLLOW_UP_OVERDUE` have independent unique keys. Sending a reminder never suppresses an overdue alert if the follow-up is missed.
- **Database Idempotency**: PostgreSQL `@unique dedupeKey` + `skipDuplicates: true` guarantees **at-most-one notification record** is created for each event.
- **Rescheduling Safety**: Changing a follow-up date/time produces a new `dueAt.toISOString()`, correctly generating new reminders for the rescheduled time.

---

## 4. The Jobs

Registered jobs live in `JOB_HANDLERS` (`src/modules/jobs/jobs.service.ts`):

| Job | What it does | Recipient | Triggered by |
|---|---|---|---|
| `follow-up-reminders` | Fires in the window before a prospect follow-up is due, using that follow-up's reminder setting (15m/30m/1h/1d, default 30m). Window: `[-1 day, +2 days]`. | The follow-up's assignee | In-process scheduler or endpoint |
| `follow-up-overdue` | Flags a follow-up whose time has passed (`now >= dueAt`). Looks back 3 days. | The follow-up's assignee | In-process scheduler or endpoint |
| `subscription-warnings` | Trial ending (at 7, 3 and 1 days), payment overdue, subscription expired. | Organization **admins** only | Endpoint only — schedule it (e.g. hourly) |
| `audit-retention` | Cleans up old audit logs beyond retention policy. | System housekeeping | Endpoint only — schedule it daily |

Not in the registry:

| Job | What it does | Triggered by |
|---|---|---|
| Token cleanup (`tokenCleanup.job.ts`) | Deletes expired refresh tokens, password-reset OTPs, and pending signups. Idempotent, so it runs safely on every replica. | `setInterval` every 6 hours from `src/index.ts`, plus once at boot |

---

## 5. External HTTP Runner

Every deployment needs this for `subscription-warnings` and `audit-retention`. When running multiple replicas, also set `ENABLE_IN_PROCESS_SCHEDULER=false` and trigger the follow-up jobs from here, so they fire once rather than once per replica:

1. Generate a secret (min 32 characters):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
2. Set `INTERNAL_JOB_SECRET` in the environment.
3. Call the endpoint on a schedule:
```http
POST https://<your-api>/api/v1/internal/jobs/run
Header:  x-internal-secret: <INTERNAL_JOB_SECRET>
Body:    {"jobs": ["subscription-warnings"]}
```

Omit `jobs` to run every registered job. `GET /api/v1/internal/jobs` lists them.

---

## 6. Observability & Monitoring

All runs emit structured Winston logs:

```json
{
  "level": "info",
  "message": "Follow-up scheduler execution finished",
  "trigger": "cron",
  "durationMs": 42,
  "totalCreated": 1,
  "results": [
    { "job": "follow-up-reminders", "created": 1, "skipped": 0, "durationMs": 24 },
    { "job": "follow-up-overdue", "created": 0, "skipped": 0, "durationMs": 18 }
  ]
}
```

- `skipped`: Number of duplicate rows ignored by idempotency deduplication. A high `skipped` with `created: 0` is normal steady-state operation.
- `error`: Logged if an individual job fails. Individual job failures do not crash the scheduler or prevent other jobs from completing.
