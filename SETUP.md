# Setup and deployment

These instructions assume no previous development setup.

## 1. Install the tools

Install:

1. [Git](https://git-scm.com/downloads).
2. [Node.js 24 LTS](https://nodejs.org/) (npm is included).
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

### Allow the studio to update GitHub Pages automatically

Create one narrowly scoped GitHub fine-grained personal access token:

1. In GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Choose **Generate new token** and name it `Mum's Bookshelf Pages rebuild`.
3. Select the `Arniox` resource owner.
4. Under **Repository access**, choose **Only select repositories**, then select `Mums-Bookshelf`.
5. Under **Repository permissions**, give **Actions: Read and write**. Leave every other optional permission at **No access**.
6. Choose an expiration. `No expiration` avoids maintenance for this single-purpose token; use a shorter expiration if you are happy to rotate it before it expires.
7. Generate and copy the token once, then store it directly in Cloudflare:

```bash
npx wrangler secret put GITHUB_PAGES_DEPLOY_TOKEN --config apps/api/wrangler.jsonc
```

Paste the token only into Wrangler's private prompt. Do not put it in `wrangler.jsonc`, a GitHub variable, the browser, or a committed `.env` file. If the token expires or is revoked, saved writing remains safe in D1; only automatic public-site rebuilds stop until the secret is replaced.

For comments with Turnstile:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY --config apps/api/wrangler.jsonc
```

## 6. Deploy the Worker

```bash
npm run build
npm run db:migrate:remote
npm run deploy:api
```

Always apply pending D1 migrations before deploying an API version that reads new fields. The public website build reads the live API and will stop rather than publish stale or demonstration content when that API is unhealthy.

Wrangler prints a URL such as `https://author-library-api.ACCOUNT.workers.dev`. Test:

```bash
curl https://author-library-api.ACCOUNT.workers.dev/api/v1/works
```

## 7. Create the first administrator

Set `PASSWORD_PEPPER` in your terminal to the same value stored in Cloudflare.

PowerShell:

```powershell
$env:PASSWORD_PEPPER = "the-same-password-pepper"
npm run admin:create -- author
Remove-Item Env:PASSWORD_PEPPER
```

macOS/Linux:

```bash
PASSWORD_PEPPER='the-same-password-pepper' npm run admin:create -- author
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
4. The editor automatically keeps a recovery copy in that browser. **Save on this device** also creates one immediately.
5. Choose **Save draft online** to store the draft privately in D1 and continue from another device.
6. Choose Link only, Excerpt, or Full story. Confirm digital rights before publishing a Full story.
7. Choose **Publish & update website**, read the warning, and confirm. The studio saves the published work and automatically starts **Validate and deploy GitHub Pages**.
8. Wait a few minutes, then refresh the public site. The studio also has an **Update public website** button for retrying a failed or delayed update.

Draft and archived records are never returned by public API endpoints.

## 10. Enable comments

Comments are off by default. Before enabling:

1. Create a Turnstile widget for the public site in Cloudflare.
2. Store its secret with `wrangler secret put TURNSTILE_SECRET_KEY`.
3. Put the public site key in GitHub variable `PUBLIC_TURNSTILE_SITE_KEY`.
4. Change `PUBLIC_COMMENTS_ENABLED` to `true` in both `wrangler.jsonc` and GitHub variables.
5. Redeploy the Worker and Pages site.

Every comment starts as pending. Approve it in **Author studio → Comments**.

## 11. Connect denisediehl.com

The repository is configured to publish the frontend at `https://denisediehl.com/`, including the author studio at `https://denisediehl.com/admin/`. Complete these steps before the first production deployment:

1. In GitHub, open **Arniox/Mums-Bookshelf → Settings → Pages → Custom domain**, enter `denisediehl.com`, and save it. GitHub will detect the committed `apps/web/public/CNAME` file after the next deployment.
2. At the company where `denisediehl.com` was purchased, create four `A` records for the root (`@`) pointing to GitHub Pages: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`. Do not use a forwarding rule for the root domain.
3. In **Settings → Pages**, enable **Enforce HTTPS** once GitHub offers it. DNS and certificate provisioning can take several hours.
4. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and set:

| Variable                    | Value                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`           | `https://denisediehl.com`                                                         |
| `PUBLIC_BASE_PATH`          | `/`                                                                               |
| `PUBLIC_API_BASE_URL`       | the deployed Worker URL, such as `https://author-library-api.ACCOUNT.workers.dev` |
| `PUBLIC_COMMENTS_ENABLED`   | `false` unless comments have been enabled deliberately                            |
| `PUBLIC_TURNSTILE_SITE_KEY` | blank unless comments use Turnstile                                               |

5. The Worker configuration now permits requests from `https://denisediehl.com`. Apply the new `0006_use_custom_domain.sql` migration and deploy the Worker before using the new admin URL.
6. Push the prepared change to `main` to deploy Pages. Verify `https://denisediehl.com/`, `https://denisediehl.com/admin/`, `https://denisediehl.com/rss.xml`, and `https://denisediehl.com/sitemap-index.xml` after the Actions workflow completes.

The domain registrar controls DNS; GitHub controls the Pages custom-domain association and HTTPS certificate. Do not add `www.denisediehl.com` to the Worker `ALLOWED_ORIGINS` unless GitHub Pages is also configured to serve or redirect that hostname.

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
| `GITHUB_PAGES_DEPLOY_TOKEN`      | Worker secret                    | Secret        | Yes      | Starts the Pages workflow     |
| `GITHUB_REPOSITORY`              | `wrangler.jsonc` Worker variable | Public config | Yes      | Pages source repository       |
| `GITHUB_PAGES_WORKFLOW`          | `wrangler.jsonc` Worker variable | Public config | Yes      | Pages workflow filename       |
| `GITHUB_DEFAULT_BRANCH`          | `wrangler.jsonc` Worker variable | Public config | Yes      | Workflow branch               |
| `CLOUDFLARE_API_TOKEN`           | GitHub Actions secret            | Secret        | CI only  | Deploys Worker                |
| `CLOUDFLARE_ACCOUNT_ID`          | GitHub Actions secret            | Secret        | CI only  | Selects Cloudflare account    |

## Troubleshooting

- **Pages assets return 404:** `PUBLIC_BASE_PATH` must be `/REPOSITORY` for a project site and `/` for a root or custom domain.
- **Admin says origin is not allowed:** add the exact scheme and hostname (no path) to `ALLOWED_ORIGINS`, then redeploy the Worker.
- **Login always fails after creating an account:** the CLI and Worker must use the identical `PASSWORD_PEPPER`.
- **A published work is absent:** choose **Update public website** in the studio. If it fails, confirm `GITHUB_PAGES_DEPLOY_TOKEN` still exists and has Actions read/write access to this repository.
- **Build cannot read the API:** confirm `PUBLIC_API_BASE_URL` and that `GET /api/v1/works` is publicly reachable.
- **Comments are missing:** both frontend and Worker comment flags must be true; unapproved comments only appear in the studio.
- **Facebook post is blank:** private, deleted, region-blocked, unsupported, or tracker-blocked posts cannot embed. The normal link remains available.
- **D1 migration fails:** confirm the database ID in `wrangler.jsonc`, then run `npx wrangler d1 migrations list author-library --remote`.
