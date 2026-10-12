# Authentication

## Strategy

The backend uses JWT access tokens plus a rotated HTTP-only refresh cookie.

- Access token: returned in JSON and expected on protected requests as `Authorization: Bearer <token>`.
- Refresh token: stored in `refresh_token`, an HTTP-only cookie scoped to `/api/v1/auth`.
- Refresh token storage: SHA-256 hash in the `RefreshToken` table.
- Default expiries: access `15m`, refresh `7d` unless overridden by env.

There is no access-token cookie in the current auth middleware.

## Cookie Contract

```ts
res.cookie("refresh_token", refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/v1/auth",
});
```

The frontend must call refresh and logout with credentials enabled.

## JWT Payload

```ts
{
  id: string;
  email: string;
  role: string;
  organizationId?: string;
  organizationPrefix?: string;
  nonce?: string;
  iat?: number;
  exp?: number;
}
```

`nonce` is added during refresh so rotated access tokens are unique.

## Auth Routes

| Route | Purpose |
| --- | --- |
| `POST /api/v1/auth/signup` | Signup step 1 — stores a `PendingSignup` and mails a 6-digit code. Creates no account |
| `POST /api/v1/auth/signup/verify` | Signup step 2 — consumes the code, creates organization/admin/subscription, signs in |
| `POST /api/v1/auth/login` | Login, returns `{ user, accessToken }`, sets refresh cookie |
| `POST /api/v1/auth/refresh` | Rotates refresh token and returns a new access token |
| `POST /api/v1/auth/logout` | Deletes the current refresh token and clears cookie |
| `POST /api/v1/auth/forgot-password/generate-otp` | Mails a 6-digit reset OTP (10-minute TTL) |
| `POST /api/v1/auth/forgot-password/reset` | Consumes the OTP, sets the password, revokes all sessions |
| `GET /api/v1/auth/me` | Returns current user from Bearer access token |
| `PATCH /api/v1/auth/profile` | Updates profile and optional uploaded assets |
| `POST /api/v1/auth/change-password` | Changes password, revokes sessions, clears cookie |

## Password Reset (OTP)

Two steps, both unauthenticated and both rate limited.

1. `generate-otp` resolves the user, revokes any pending OTPs, and stores a new
   one as `HMAC-SHA256(JWT_SECRET, "<email>:<otp>")` in `PasswordResetOtp`. The
   plaintext code exists only in the email. Delivery failure revokes the OTP and
   returns `503` — the user is never left with a code that was never sent.
2. `reset` re-resolves the user, hashes the submitted code, and consumes it
   inside a transaction. Single-use is enforced by a conditional `updateMany`
   whose `count` is checked, not by the preceding read, so two concurrent
   submissions cannot both succeed. Success revokes every refresh token.

A wrong code increments `failedAttempts` on the pending OTP; at 5 the OTP is
revoked and a new one must be requested. Both failure modes return the same
generic message.

Note: `generate-otp` returns `404` for an unknown email rather than a generic
"if the account exists" response. That is an accepted account-existence oracle,
bounded by the rate limiter.

## Signup (two requests)

Signup proves the email address **before** the account exists. There is no
verification banner, no resend endpoint and no middleware gating writes on a
confirmed address, because no unverified account is ever created.

The UI collects this in three steps — **Organization → Account → Verify**. The
organization comes first so the work email is typed on the last screen before
the code is sent, and step 1 never touches the network: the server only ever
receives one complete payload.

`SignupSchema` = `SignupOrganizationSchema` + `SignupAccountSchema`, whose field
rules come from the shared `OrganizationFields` so signup cannot drift from the
super-admin form:

| Organization | Account |
| --- | --- |
| `companyName`, `orgType`, `address`, `orgMobile` (required) | `firstName`, `lastName`, `email`, `mobile`, `password` (required) |
| `orgEmail`, `authorizedPerson`, `dateOfRegistration`, `gstin`, `remark` (optional) | |

Optional fields arrive as `""` and are stored as `NULL`. `orgEmail` and
`authorizedPerson` default to the admin's email and full name on verify, because
step 1 comes before the admin account exists. Bank details and PDF assets are not
part of signup — they live in Settings → Quotation.

**Step 1 — `POST /auth/signup`** (`SignupSchema`). Creates nothing:

1. Normalize the email, reject it if a `User` already has it (`409` — an
   accepted account-existence oracle, same as before, bounded by the limiter).
2. Pre-flight `resolveSelfServiceSignupPlan()` — no point mailing a code the
   user cannot redeem.
3. `hashPassword` once, stored on the row, so the plaintext is never re-sent.
4. In one transaction: delete any existing `PendingSignup` for the address, then
   create the new one (15-minute TTL).
5. **Await** the mail. A delivery failure deletes the row and returns `503` —
   there is no committed account to fall back on, so leaving the row behind
   would strand the user waiting for mail that never arrives.

**Step 2 — `POST /auth/signup/verify`** (`SignupVerifySchema`: `email` + `otp`).
Hash the code, look the row up by `otpHash`, then:

- A wrong or unknown code burns an attempt on the **pending row for that
  address** — not on the submitted hash, which does not exist, so counting
  against it would bound nothing. At 5 failures the row is deleted and a new
  code must be requested. Every failure mode returns the same generic message.
- The plan is re-resolved: an operator may have changed it while the code sat in
  the user's inbox.
- Inside the identifier-retry transaction, the row is consumed with a
  **conditional `deleteMany` whose `count` is checked**. That is the single-use
  guarantee — without it two simultaneous confirms would create two
  organizations. It sits inside the retried transaction deliberately, so a
  slug collision rolls the delete back and the next attempt can still consume it.
- The name, company and password hash come from the stored row, never from the
  request, so proving one address cannot create an org under another.
- The admin user is created with **`emailVerifiedAt` already set**.

The OTP hash is domain-separated — `HMAC(JWT_SECRET, "signup:<email>:<otp>")` —
so a signup code can never be presented as a password-reset code.

`User.emailVerifiedAt` stays `NULL` for users a super-admin or an org admin
creates directly; those addresses have never been confirmed by their owner.
Nothing gates on it today — it is the honest record, kept for support and audit.

## `requireAuth`

`requireAuth` in `src/middlewares/auth.middleware.ts`:

1. Reads the `Authorization` header.
2. Requires `Bearer <token>` format.
3. Verifies the access token with `JWT_SECRET`.
4. Fetches the user from the database.
5. Blocks inactive users.
6. Blocks users whose organization is not `ACTIVE`.
7. Rejects tokens issued before `passwordChangedAt`.
8. Attaches the user to `req.user`.

## Refresh Rotation

`authService.refresh`:

1. Reads the `refresh_token` cookie.
2. Verifies it with `JWT_REFRESH_SECRET`.
3. Hashes the incoming token and looks up `RefreshToken`.
4. Allows one reuse inside a 30-second grace window for multi-tab refresh.
5. Treats a second reuse after rotation as replay and deletes all user refresh tokens.
6. Creates a new hashed refresh token row.
7. Marks the old token as replaced.
8. Returns a new access token and sets a new refresh cookie.

## CSRF

`csrfProtection` (`src/middlewares/csrf.middleware.ts`) requires every state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) to carry a non-empty custom header. A cross-site form cannot set one, so its presence proves the request came from script on an allowed origin:

```bash
x-requested-with: XMLHttpRequest
# or
x-csrf-token: <non-empty-value>
```

Exemptions:

- Safe methods: `GET`, `HEAD`, `OPTIONS`.
- `POST /api/v1/auth/login`.
- `GET /health`.
- `/api/v1/internal/*` and `/api/v1/billing/webhook/*`, because `app.ts` mounts them before the middleware. They authenticate by shared secret and HMAC signature instead.

`POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout` are **not** exempt: they act on the refresh cookie, which is exactly what CSRF targets.

## Rate Limits

Limits marked "(dev: N)" are deliberately loosened when `NODE_ENV=development`
so local testing is not blocked by a production-shaped limit.

| Limiter | Routes | Limit |
| --- | --- | --- |
| `authLimiter` | login | 5 requests per 5 minutes |
| `signupLimiter` | signup step 1 (mail a code) | 5 requests per 15 minutes (dev: 50) |
| `signupVerifyLimiter` | signup step 2 (redeem the code) | 10 requests per 15 minutes (dev: 100) |
| `refreshLimiter` | refresh | 10 requests per 5 minutes |
| `passwordResetLimiter` | forgot-password OTP request, admin user password reset | 5 requests per 15 minutes (dev: 50) |
| `passwordResetTokenLimiter` | forgot-password reset | 10 requests per 15 minutes |
| `apiLimiter` | every `/api/v1` route except internal jobs and the billing webhook | 500 requests per 15 minutes |

## Frontend Coupling

How the SPA holds the access token, sends these headers, and coordinates refresh across tabs is in [frontend/docs/frontend-auth.md](../../frontend/docs/frontend-auth.md).
