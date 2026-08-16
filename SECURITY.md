# Security

## Reporting

Do not open a public issue for a suspected security vulnerability. Contact the repository owner privately with the affected route, reproduction steps, impact, and any suggested mitigation.

## Security design

- Passwords are derived with PBKDF2-SHA-256 and a server-only pepper. Passwords and hashes never reach the frontend.
- Access tokens are short-lived and held only in page memory. A random refresh token is stored in a `Secure`, `HttpOnly`, `SameSite=None`, host-only API cookie; only its SHA-256 hash is stored in D1.
- Every access token is tied to an active, revocable D1 session. Logout revokes it.
- Admin routes require authorization on every request. Mutation requests must have an exact allow-listed `Origin`.
- Cross-origin cookies are required for a `github.io` frontend and `workers.dev` API. The API returns credentials only to configured origins and never uses a wildcard origin.
- Login and comment routes are rate limited. Login failures are generic.
- Public D1 queries select only published works. Projection logic removes restricted story fields before JSON serialization.
- Markdown is rendered through `marked` and sanitised with DOMPurify. Comment text is escaped and moderated.
- Authenticated responses should not be cached; the Worker emits secure headers and callers use credentialed requests. Never place a CDN cache rule over `/api/v1/auth/*` or `/api/v1/admin/*`.
- Request bodies have explicit limits. Production errors never expose stack traces.
- Automatic Pages rebuilds use a fine-grained GitHub token stored only as an encrypted Worker secret. The browser can request a rebuild only through an authenticated, exact-origin admin route and never receives the token.

## Operator responsibilities

Use unrelated, randomly generated values of at least 32 bytes for `JWT_SIGNING_SECRET`, `PASSWORD_PEPPER`, and `IP_HASH_SECRET`. Store them with `wrangler secret put`; never in GitHub variables, source files, screenshots, or support messages.

Keep `ALLOWED_ORIGINS` exact. Do not include trailing paths, wildcards, or untrusted preview domains. Rotate secrets and revoke sessions after a suspected compromise.

Limit `GITHUB_PAGES_DEPLOY_TOKEN` to this repository with only **Actions: Read and write**. Revoke and replace it immediately if exposed. Local editor recovery copies can contain unpublished writing, so avoid the studio on shared browser profiles and clear site data before giving a device away.

Turnstile is optional, but recommended before enabling public comments. Comments remain moderated even when Turnstile is enabled.

Review dependency updates and GitHub Actions logs regularly. D1 backups may contain unpublished writing and should be encrypted at rest.
