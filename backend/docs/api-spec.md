# API Spec

## Base Contract

- Versioned API base path: `/api/v1`.
- Health endpoint: `GET /health`.
- Static uploaded assets: `GET /uploads/*`.
- JSON content type by default. File uploads use `multipart/form-data`.
- Success responses use `ApiResponse.ok` or `ApiResponse.created`.
- Error responses are produced by `errorHandler`.

## Auth And Security Headers

Protected routes require:

```bash
Authorization: Bearer <accessToken>
```

The access token is returned in auth JSON responses. The refresh token is an HTTP-only cookie named `refresh_token`, scoped to `/api/v1/auth`.

State-changing requests must also send `x-requested-with: XMLHttpRequest` (or a non-empty `x-csrf-token`). Exemptions and the reasoning are in [authentication.md](authentication.md#csrf).

## Organization Scope

Tenant-scoped routers mount `requireOrganization`.

- Non-super-admin users are scoped from `req.user.organizationId`.
- Super admin users must send `x-organization-id: <organizationId>` for tenant data routes.
- Organization scope is never accepted from query or body.

Tenant data modules with write subscription enforcement:

- `/users`
- `/items`
- `/leads`
- `/prospects`
- `/quotations`

Reads stay available when a subscription lapses. Writes return `402` with `SUBSCRIPTION_REQUIRED` when the subscription is read-only. Super admin writes are exempt.

## Response Shapes

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

Errors use the shape in [error-handling.md](error-handling.md#error-response).

## Public And Auth Routes

### Auth: `/api/v1/auth`

| Method | Path | Middleware | Schema | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/signup` | `signupLimiter` | `SignupSchema` | `{ email }`, mails a 6-digit code. **Creates no account** |
| `POST` | `/signup/verify` | `signupVerifyLimiter` | `SignupVerifySchema` | `{ user, accessToken }`, sets `refresh_token` |
| `POST` | `/login` | `authLimiter` | `LoginSchema` | `{ user, accessToken }`, sets `refresh_token` |
| `POST` | `/refresh` | `refreshLimiter` | refresh cookie | `{ accessToken }`, rotates `refresh_token` |
| `POST` | `/logout` | none | refresh cookie optional | `null`, clears cookie |
| `POST` | `/forgot-password/generate-otp` | `passwordResetLimiter` | `ForgotPasswordSchema` | `{ message }`, mails a 6-digit OTP |
| `POST` | `/forgot-password/reset` | `passwordResetTokenLimiter` | `ResetPasswordSchema` | `{ message }`, revokes all sessions |
| `GET` | `/me` | `requireAuth` | none | `{ user }` |
| `PATCH` | `/profile` | `requireAuth`, multipart upload | `UpdateProfileSchema` | `{ user }` |
| `POST` | `/change-password` | `requireAuth` | `ChangePasswordSchema` | `null`, clears cookie |

Profile upload fields: `profileImage`, `companyLogo`, `qrCode`, `signature`.

Signup is **two requests** — see `authentication.md`. `POST /signup` only mails
a code; `POST /signup/verify` is what creates the organization and returns a
session. Nothing gates on `AuthUser.emailVerifiedAt`: self-service accounts are
created with it already set, so there is nothing to chase afterwards.

Self-service signup requires `PlatformSetting.defaultPlanId` to point at an
active, public plan, otherwise `POST /signup` returns `400`. `npm run seed:plans`
sets it to the `MONTHLY` plan when it is unset, so a fresh install is not
shipped with signup disabled.

## Tenant Data Routes

### Users: `/api/v1/users`

Middleware: `requireAuth`, `requireOrganization`, `enforceSubscription`.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/` | `user:create` | `CreateUserSchema` | `User` |
| `GET` | `/` | `user:read` | `UserFilterSchema` query | `User[]` plus `meta` |
| `GET` | `/stats` | `user:read` | none | user stats |
| `GET` | `/:id` | `user:read` | `id` param | `User` |
| `PUT` | `/:id` | `user:update` | `UpdateUserSchema` | `User` |
| `POST` | `/:id/reset-password` | `user:update`, service enforces super admin | `id` param | `{ user, temporaryPassword }` |
| `PATCH` | `/:id/disable` | `user:disable` | `id` param | `User` |
| `PATCH` | `/:id/enable` | `user:enable` | `id` param | `User` |
| `DELETE` | `/:id` | `user:delete` | `id` param | `null` |

### Items: `/api/v1/items`

Middleware: `requireAuth`, `requireOrganization`, `enforceSubscription`.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/` | `item:create` | `CreateItemSchema` | `Item` |
| `GET` | `/stats` | `item:read` | none | item stats |
| `GET` | `/` | `item:read` | `ItemFilterSchema` query | `Item[]` plus `meta` |
| `GET` | `/:id` | `item:read` | `id` param | `Item` |
| `PATCH` | `/:id` | `item:update` | `UpdateItemSchema` | `Item` |
| `PATCH` | `/:id/toggle-status` | `item:update` | `id` param | `Item` |
| `DELETE` | `/:id` | `item:delete` | `id` param | `null` |

### Leads: `/api/v1/leads`

Middleware: `requireAuth`, `requireOrganization`, `enforceSubscription`.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/` | `lead:create` | multipart or JSON `CreateLeadSchema` | `Lead` |
| `POST` | `/import` | `lead:create` | multipart field `file` | `{ count }` |
| `GET` | `/assignable-users` | `lead:read` | none | user previews |
| `GET` | `/` | `lead:read` | `LeadFilterSchema` query | `Lead[]` plus `meta` |
| `GET` | `/:id/activities` | `lead:read` | `id` param | lead activity timeline |
| `POST` | `/:id/activities` | `lead:update` | `CreateLeadActivitySchema` | `LeadActivity` |
| `PATCH` | `/:id/activities/:activityId` | `lead:update` | `UpdateLeadActivitySchema` | `LeadActivity` |
| `DELETE` | `/:id/activities/:activityId` | `lead:update` | `id`, `activityId` params | `null` |
| `GET` | `/:id` | `lead:read` | `id` param | `Lead` |
| `PATCH` | `/:id` | `lead:update` | multipart or JSON `UpdateLeadSchema` | `Lead` |
| `PATCH` | `/:id/status` | `lead:update` | `UpdateLeadStatusSchema` | `Lead` |
| `DELETE` | `/:id` | `lead:delete` | `id` param | `null` |
| `POST` | `/:id/convert` | `lead:update` | `ConvertLeadToProspectFromLeadSchema` | `Prospect` |
| `PATCH` | `/:id/assign` | `lead:update` | `AssignLeadSchema` | `Lead` |

Lead profile image upload field: `profilePicture`. Lead import upload field: `file`.

Each activity response says whether the caller may still edit or delete it; that rule lives in `utils/activity/activityPolicy.ts`.

### Prospects: `/api/v1/prospects`

Middleware: `requireAuth`, `requireOrganization`, `enforceSubscription`.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/` | `prospect:read` | `ProspectFilterSchema` query | `Prospect[]` plus `meta` |
| `GET` | `/customer-stats` | `prospect:read` | none | customer stats |
| `GET` | `/:id` | `prospect:read` | `id` param | `Prospect` |
| `POST` | `/convert` | `prospect:create` | `ConvertLeadToProspectSchema` | `Prospect` |
| `PATCH` | `/:id` | `prospect:update` | `UpdateProspectSchema` | `Prospect` |
| `PATCH` | `/:id/stage` | `prospect:update` | `UpdateProspectStageSchema` | `Prospect` |
| `DELETE` | `/:id` | `prospect:delete` | `id` param | `null`. `WON`/`LOST` prospects cannot be deleted |

Follow-ups (handled by `modules/followUp`):

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/:id/follow-ups` | `prospect:update` | `ScheduleFollowUpSchema` | `FollowUp` |
| `GET` | `/:id/follow-ups` | `prospect:read` | `id` param | follow-up history |
| `GET` | `/:id/follow-ups/active` | `prospect:read` | `id` param | the pending `FollowUp`, or `null` |
| `PATCH` | `/:id/follow-ups/:fId/complete` | `prospect:update` | `CompleteFollowUpSchema` | `FollowUp` |
| `PATCH` | `/:id/follow-ups/:fId/missed` | `prospect:update` | `MarkMissedSchema` | `FollowUp` |
| `PATCH` | `/:id/follow-ups/:fId/reschedule` | `prospect:update` | `RescheduleFollowUpSchema` | `FollowUp` |
| `PATCH` | `/:id/follow-ups/:fId/cancel` | `prospect:update` | `CancelFollowUpSchema` | `FollowUp` |
| `PATCH` | `/:id/follow-ups/:fId` | `prospect:update` | `EditFollowUpSchema` | `FollowUp` |

Activities (nested router `modules/prospectActivity`, mounted at `/:id/activities`):

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/:id/activities` | `prospect:read` | `id` param | timeline page |
| `POST` | `/:id/activities` | `prospect:update` | `LogProspectActivitySchema` | `ProspectActivity` (`201`; `200` if the `clientRequestId` was already logged) |
| `PATCH` | `/:id/activities/:activityId` | `prospect:update` | `UpdateProspectActivitySchema` | `ProspectActivity` |
| `DELETE` | `/:id/activities/:activityId` | `prospect:update` | `id`, `activityId` params | `null` |

### Quotations: `/api/v1/quotations`

Middleware: `requireAuth`, `requireOrganization`, `enforceSubscription`.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `POST` | `/` | `quotation:create` | `CreateQuotationSchema` | `Quotation` |
| `GET` | `/` | `quotation:read` | `QuotationFilterSchema` query | `Quotation[]` plus `meta` |
| `GET` | `/stats` | `quotation:read` | none | quotation stats |
| `GET` | `/:id` | `quotation:read` | `id` param | `Quotation` |
| `PATCH` | `/:id` | `quotation:update` | `UpdateQuotationSchema` | `Quotation` |
| `DELETE` | `/:id` | `quotation:delete` | `id` param | `null` |
| `POST` | `/attachments/temp` | `quotation:create` | multipart field `file` | temporary attachment, referenced when the quotation is created |
| `POST` | `/:id/attachments` | `quotation:update` | multipart field `file` | attachment |
| `GET` | `/:id/attachments/:attachmentId/url` | `quotation:read` | params | signed download URL |
| `DELETE` | `/:id/attachments/:attachmentId` | `quotation:update` | params | `null` |

## Platform And Shared Routes

### Organizations: `/api/v1/organizations`

Middleware: `requireAuth`. Most routes are super-admin/platform permissions.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/by-slug/:slug` | authenticated | `OrganizationSlugParamSchema` | `Organization` |
| `GET` | `/` | `org:list:global` | `OrganizationFilterSchema` query | `Organization[]` plus `meta` |
| `POST` | `/` | `org:create` | multipart `CreateOrganizationSchema` | `CreateOrganizationResult` |
| `GET` | `/:id` | `org:read` | `id` param | `Organization` |
| `PATCH` | `/:id` | `org:update` | multipart `UpdateOrganizationSchema` | `Organization` |
| `PATCH` | `/:id/status` | `org:update` | `{ status }` | `Organization` |
| `DELETE` | `/:id` | `org:delete` | `id` param | archived `Organization` |
| `PATCH` | `/:id/restore` | `org:delete` | `id` param | restored `Organization` |
| `GET` | `/:id/users` | `user:read` | `id` param | `User[]` |

Organization asset upload fields: `companyLogo`, `qrCode`, `signature`.

`ORG_UPDATE` is held by `ADMIN`, and `ensureSameOrg` scopes every one of these to
the caller's own organization. An ADMIN therefore edits their own company
profile — `name`, `authorizedPerson`, `email`, `mobile`, `gstin`, `address`,
`dateOfRegistration` — through `PATCH /:id`, which is what Settings → Company
uses.

**`slug`, `prefix` and `status` are super-admin only.** `UpdateOrganizationSchema`
is `.partial()` without `.strict()`, so all three survive validation;
`organizationService.updateOrganization` rejects them with `403` for any
non-super-admin caller. `prefix` is the root of quotation numbering
(`${prefix}-QT-${year}-0001`), so letting a tenant rewrite it would rename every
future document series and break continuity with the ones already sent.

### Dashboard: `/api/v1/dashboard`

All routes mount `requireAuth` and `dashboard:read`.

| Method | Path | Scope | Returns |
| --- | --- | --- | --- |
| `GET` | `/super-admin` | super admin, not org-scoped | `SuperAdminStatsDTO` |
| `GET` | `/admin` | admin, org-scoped | `AdminStatsDTO` |
| `GET` | `/manager` | manager, org-scoped | `ManagerStatsDTO` |
| `GET` | `/executive` | executive, org-scoped | `ExecutiveStatsDTO` |

### Reports: `/api/v1/reports`

Middleware: `requireAuth`, `requireOrganization`, `reports:read`.

| Method | Path | Schema | Returns |
| --- | --- | --- | --- |
| `GET` | `/` | `ReportFilterSchema` query | report data envelope |
| `GET` | `/?exportType=lead` | `ReportFilterSchema` query | CSV |
| `GET` | `/?exportType=prospect` | `ReportFilterSchema` query | CSV |
| `GET` | `/?exportType=quotation` | `ReportFilterSchema` query | CSV |
| `GET` | `/?exportType=performance` | `ReportFilterSchema` query | CSV |

### Audit Logs: `/api/v1/audit-logs`

Middleware: `requireAuth`, `audit:read`, `requireFeature("AUDIT_LOG_ACCESS")`.

| Method | Path | Schema | Returns |
| --- | --- | --- | --- |
| `GET` | `/` | `AuditLogFilterSchema` query | `AuditLogEntry[]` plus `meta` |
| `GET` | `/export` | `AuditLogFilterSchema` query | CSV |

### Announcements: `/api/v1/announcements`

Middleware: `requireAuth`. Viewer routes are available to any authenticated user. Authoring routes also require `ANNOUNCEMENTS` feature and announcement permissions.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/feed` | authenticated | `AnnouncementFeedSchema` query | `AnnouncementFeedItem[]` plus feed meta |
| `POST` | `/read-all` | authenticated | none | receipt result |
| `POST` | `/:id/read` | authenticated | `id` param | receipt result |
| `POST` | `/:id/dismiss` | authenticated | `id` param | receipt result |
| `GET` | `/` | `announcement:read` | `AnnouncementFilterSchema` query | `AnnouncementListItem[]` plus `meta` |
| `POST` | `/` | `announcement:create` | `CreateAnnouncementSchema` | `AnnouncementListItem` |
| `GET` | `/:id` | `announcement:read` | `id` param | `AnnouncementListItem` |
| `PATCH` | `/:id` | `announcement:update` | `UpdateAnnouncementSchema` | `AnnouncementListItem` |
| `POST` | `/:id/publish` | `announcement:publish` | `id` param | `AnnouncementListItem` |
| `POST` | `/:id/archive` | `announcement:publish` | `id` param | `AnnouncementListItem` |
| `DELETE` | `/:id` | `announcement:delete` | `id` param | soft-deleted announcement |

### Billing: `/api/v1/billing`

Middleware: `requireAuth`. Billing deliberately does not mount subscription enforcement.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/plans` | `billing:read` | `PlanFilterSchema` query | `PlanSummary[]` plus `meta` |
| `POST` | `/plans` | `plan:manage` | `CreatePlanSchema` | `PlanSummary` |
| `PATCH` | `/plans/:id` | `plan:manage` | `UpdatePlanSchema` | `PlanSummary` |
| `GET` | `/subscriptions` | `billing:manage` | `SubscriptionFilterSchema` query | `SubscriptionSummary[]` plus `meta` |
| `GET` | `/unsubscribed-organizations` | `billing:manage` | none | organizations without subscriptions |
| `GET` | `/subscriptions/:organizationId` | `billing:manage` | `organizationId` param | `SubscriptionSummary` |
| `POST` | `/subscriptions/:organizationId` | `billing:manage` | `AssignInitialPlanSchema` | `SubscriptionSummary` |
| `PATCH` | `/subscriptions/:organizationId` | `billing:manage` | `UpdateSubscriptionSchema` | `SubscriptionSummary` |
| `PUT` | `/subscriptions/:organizationId/features` | `billing:manage` | `UpdateFeatureOverridesSchema` | `SubscriptionSummary` |
| `POST` | `/subscriptions/:organizationId/cancel` | `billing:manage` | `CancelSubscriptionSchema` | `SubscriptionSummary` |
| `GET` | `/subscription` | `billing:read`, org-scoped | none | caller org subscription |
| `GET` | `/subscription/status` | authenticated, org-scoped | none | safe subscription status |
| `GET` | `/usage` | `billing:read`, org-scoped | none | `BillingUsage` |
| `POST` | `/payment/orders` | `billing:read`, org-scoped | `CreateOrderSchema` | Razorpay order for Checkout |
| `POST` | `/payment/verify` | `billing:read`, org-scoped | `VerifyPaymentSchema` | verifies the Checkout signature and activates the plan |
| `GET` | `/payment/history` | `billing:read`, org-scoped | none | caller org `Payment[]` plus `meta` |
| `GET` | `/payments` | `billing:manage` | none | all `Payment[]` plus `meta` |

### Billing Webhook: `/api/v1/billing/webhook`

Separate router (`billing/webhook.route.ts`), mounted before CSRF and rate limiting. No user auth: each call is verified by HMAC-SHA256 of the raw body against `RAZORPAY_WEBHOOK_SECRET` (`x-razorpay-signature` header).

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/razorpay` | raw Razorpay event JSON | `200` on accepted events |

### Notifications: `/api/v1/notifications`

Middleware: `requireAuth`. Notification repository scopes by caller `userId`.

| Method | Path | Schema | Returns |
| --- | --- | --- | --- |
| `GET` | `/` | `NotificationFeedSchema` query | `NotificationItem[]` plus feed meta |
| `PATCH` | `/read-all` | none | `{ unreadCount }` |
| `PATCH` | `/:id/read` | `id` param | `{ unreadCount }` |
| `DELETE` | `/:id` | `id` param | `{ unreadCount }` |

### Platform Settings: `/api/v1/platform-settings`

Middleware: `requireAuth`. No tenant scoping.

| Method | Path | Permission | Schema | Returns |
| --- | --- | --- | --- | --- |
| `GET` | `/public` | authenticated | none | `PublicPlatformSettings` |
| `GET` | `/` | `platform:manage` | none | `PlatformSettings` |
| `PATCH` | `/` | `platform:manage` | `UpdatePlatformSettingsSchema` | `PlatformSettings` |

### Internal Jobs: `/api/v1/internal`

Mounted before CSRF and rate limiting. Requires `x-internal-secret` matching `INTERNAL_JOB_SECRET`.

| Method | Path | Schema | Returns |
| --- | --- | --- | --- |
| `GET` | `/jobs` | none | `{ jobs }` |
| `POST` | `/jobs/run` | `RunJobsSchema` | job run summary |

## Common Query Parameters

Paginated list schemas generally accept:

```ts
{
  page?: number;
  limit?: number;
  search?: string;
}
```

Feature-specific filters live in `backend/src/contracts/validation/*.schemas.ts` and are shared into the frontend contracts.

## Notable Lifecycle Rules

- Lead status values: `NEW`, `ATTEMPTED_CONTACT`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`.
- Lead conversion requires a qualified lead and produces or returns a `Prospect`.
- Prospect stages: `REQUIREMENT`, `FOLLOW_UP`, `DEMO`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`. `WON` and `LOST` are terminal.
- A prospect has at most one `PENDING` follow-up. It ends as `COMPLETED` (with an outcome), `MISSED`, `CANCELLED`, or `RESCHEDULED` (which creates the replacement follow-up).
- Quotations use optimistic versioning through `expectedVersion` in `UpdateQuotationSchema`.
- Billing feature overrides use `PUT` because the request replaces the complete override set.
