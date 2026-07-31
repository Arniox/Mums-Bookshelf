# Setup and deployment

These instructions assume no previous development setup.

## 1. Install the tools

Install:

1. [Git](https://git-scm.com/downloads).
2. [Node.js 22 LTS](https://nodejs.org/) (npm is included).
3. A free [GitHub](https://github.com/) account.
4. A [Cloudflare](https://dash.cloudflare.com/sign-up) account.

Check the installations in a terminal:

```bash
git --version
node --version
npm --version
npx wrangler --version
```

## 2. Create the GitHub repository

Create an empty repository on GitHub. In this project folder:

```bash
git init
git add .
git commit -m "Build author bookshelf website"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Replace `USERNAME` and `REPOSITORY` throughout this guide.

## 3. Install and run locally

```bash
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

The web address is normally `http://localhost:4321`; the API is normally `http://localhost:8787`. Copy `.env.example` to `.env` for web settings. Create `apps/api/.dev.vars` for Worker secrets:

```dotenv
JWT_SIGNING_SECRET=replace-with-at-least-32-random-bytes
PASSWORD_PEPPER=replace-with-a-different-32-byte-secret
IP_HASH_SECRET=replace-with-another-32-byte-secret
```

Do not commit either file.

## 4. Create D1

Sign in and create the database:

```bash
npx wrangler login
npx wrangler d1 create author-library
```

Cloudflare prints a `database_id`. Replace the zero UUID in `apps/api/wrangler.jsonc` with that exact value, then apply and seed the remote database:

```bash
npx wrangler d1 migrations apply author-library --remote
npx wrangler d1 execute author-library --remote --file apps/api/migrations/0002_seed.sql
```

The seed is fictional. It is safe to remove or edit before launch.

## 5. Configure Worker settings and secrets

Edit `apps/api/wrangler.jsonc`:

- Set `ALLOWED_ORIGINS` to the exact Pages origin, such as `https://USERNAME.github.io`. A custom frontend origin can be appended with a comma.
- Set `ENVIRONMENT` to `production`.
- Set `PUBLIC_COMMENTS_ENABLED` to `false` until moderation and optional Turnstile are ready.

Create secrets. Each command prompts without writing the value to source:

```bash
npx wrangler secret put JWT_SIGNING_SECRET --config apps/api/wrangler.jsonc
npx wrangler secret put PASSWORD_PEPPER --config apps/api/wrangler.jsonc
npx wrangler secret put IP_HASH_SECRET --config apps/api/wrangler.jsonc
```

For comments with Turnstile:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY --config apps/api/wrangler.jsonc
```

## 6. Deploy the Worker

```bash
npm run build
npm run deploy:api
```

Wrangler prints a URL such as `https://author-library-api.ACCOUNT.workers.dev`. Test:

```bash
curl https://author-library-api.ACCOUNT.workers.dev/api/v1/works
```

## 7. Create the first administrator

Set `PASSWORD_PEPPER` in your terminal to the same value stored in Cloudflare.

PowerShell:

```powershell
$env:PASSWORD_PEPPER = "the-same-password-pepper"
npm run admin:create -- --username author
Remove-Item Env:PASSWORD_PEPPER
```

macOS/Linux:

```bash
PASSWORD_PEPPER='the-same-password-pepper' npm run admin:create -- --username author
```

The command securely derives the password and prints one `wrangler d1 execute` command. Run that printed command. The plaintext password is never inserted into D1.

## 8. Configure GitHub Pages

In GitHub, open **Settings → Pages** and choose **GitHub Actions** as the source.

Open **Settings → Secrets and variables → Actions → Variables** and create:

| Variable                    | Root-domain site             | Repository site                         |
| --------------------------- | ---------------------------- | --------------------------------------- |
| `PUBLIC_SITE_URL`           | `https://USERNAME.github.io` | `https://USERNAME.github.io/REPOSITORY` |
| `PUBLIC_BASE_PATH`          | `/`                          | `/REPOSITORY`                           |
| `PUBLIC_API_BASE_URL`       | Worker URL                   | Worker URL                              |
| `PUBLIC_COMMENTS_ENABLED`   | `false`                      | `false`                                 |
| `PUBLIC_TURNSTILE_SITE_KEY` | blank                        | blank                                   |

Push to `main`. The Pages workflow installs from the lockfile, checks formatting, lint, types and tests, builds both applications, then deploys only if everything passes.

For the Worker workflow, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub **secrets**. Use a narrowly scoped token with Workers Scripts and D1 edit permissions. The workflow is manual to avoid accidental database-facing deployments.

## 9. Publish the first real work

1. Open `https://USERNAME.github.io/REPOSITORY/admin/`.
2. Sign in.
3. Choose **Add new work**.
4. Leave the status as **Draft** while editing.
5. Choose Link only, Excerpt, or Full story. Confirm digital rights before Full story.
6. Change the status to **Published** and save.
7. In GitHub Actions, run **Validate and deploy GitHub Pages**. Static work URLs are generated during this build.

Draft and archived records are never returned by public API endpoints.

## 10. Enable comments

Comments are off by default. Before enabling:

1. Create a Turnstile widget for the public site in Cloudflare.
2. Store its secret with `wrangler secret put TURNSTILE_SECRET_KEY`.
3. Put the public site key in GitHub variable `PUBLIC_TURNSTILE_SITE_KEY`.
4. Change `PUBLIC_COMMENTS_ENABLED` to `true` in both `wrangler.jsonc` and GitHub variables.
5. Redeploy the Worker and Pages site.

Every comment starts as pending. Approve it in **Author studio → Comments**.

## 11. Custom domains

For the frontend, add the domain in GitHub **Settings → Pages**, then set `PUBLIC_SITE_URL` to it and `PUBLIC_BASE_PATH` to `/`. Add the exact new origin to `ALLOWED_ORIGINS`.

For the API, add a Worker custom domain in Cloudflare Workers & Pages, then update `PUBLIC_API_BASE_URL`. Redeploy both applications. The host-only refresh cookie remains on the API domain.

## 12. Backup and export

In Author studio, choose **Export data** for a versioned JSON export of works, settings, and approved comments.

Create a full D1 SQL backup:

```bash
npx wrangler d1 export author-library --remote --output author-library-backup.sql
```

Store exports securely: they can contain draft writing and reader comments.

## 13. Environment locations

| Name                             | Location                         | Visibility    | Required | Purpose                       |
| -------------------------------- | -------------------------------- | ------------- | -------- | ----------------------------- |
| `PUBLIC_SITE_URL`                | local `.env`, GitHub variable    | Public        | Yes      | Canonical site URL            |
| `PUBLIC_BASE_PATH`               | local `.env`, GitHub variable    | Public        | Yes      | `/` or `/REPOSITORY` path     |
| `PUBLIC_API_BASE_URL`            | local `.env`, GitHub variable    | Public        | Yes      | Worker API URL                |
| `PUBLIC_COMMENTS_ENABLED`        | web variable and Worker variable | Public        | Yes      | Enables comment UI and route  |
| `PUBLIC_TURNSTILE_SITE_KEY`      | GitHub variable                  | Public        | No       | Browser Turnstile key         |
| `ALLOWED_ORIGINS`                | `wrangler.jsonc` Worker variable | Public config | Yes      | Exact frontend origins        |
| `AUTH_TOKEN_ISSUER`              | `wrangler.jsonc` Worker variable | Public config | Yes      | JWT issuer                    |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS`  | `wrangler.jsonc` Worker variable | Public config | Yes      | Access token lifetime         |
| `AUTH_REFRESH_TOKEN_TTL_SECONDS` | `wrangler.jsonc` Worker variable | Public config | Yes      | Session lifetime              |
| `ENVIRONMENT`                    | `wrangler.jsonc` Worker variable | Public config | Yes      | Error/log mode                |
| `JWT_SIGNING_SECRET`             | `.dev.vars`, Worker secret       | Secret        | Yes      | Signs access tokens           |
| `PASSWORD_PEPPER`                | `.dev.vars`, Worker secret       | Secret        | Yes      | Strengthens password hashes   |
| `IP_HASH_SECRET`                 | `.dev.vars`, Worker secret       | Secret        | Yes      | Pseudonymises rate-limit keys |
| `TURNSTILE_SECRET_KEY`           | `.dev.vars`, Worker secret       | Secret        | No       | Verifies Turnstile responses  |
| `CLOUDFLARE_API_TOKEN`           | GitHub Actions secret            | Secret        | CI only  | Deploys Worker                |
| `CLOUDFLARE_ACCOUNT_ID`          | GitHub Actions secret            | Secret        | CI only  | Selects Cloudflare account    |

## Troubleshooting

- **Pages assets return 404:** `PUBLIC_BASE_PATH` must be `/REPOSITORY` for a project site and `/` for a root or custom domain.
- **Admin says origin is not allowed:** add the exact scheme and hostname (no path) to `ALLOWED_ORIGINS`, then redeploy the Worker.
- **Login always fails after creating an account:** the CLI and Worker must use the identical `PASSWORD_PEPPER`.
- **A published work is absent:** run the Pages workflow. GitHub Pages is static, so new work pages appear after a successful rebuild.
- **Build cannot read the API:** confirm `PUBLIC_API_BASE_URL` and that `GET /api/v1/works` is publicly reachable.
- **Comments are missing:** both frontend and Worker comment flags must be true; unapproved comments only appear in the studio.
- **Facebook post is blank:** private, deleted, region-blocked, unsupported, or tracker-blocked posts cannot embed. The normal link remains available.
- **D1 migration fails:** confirm the database ID in `wrangler.jsonc`, then run `npx wrangler d1 migrations list author-library --remote`.
