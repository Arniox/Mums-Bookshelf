---
name: mums-bookshelf-repository-operations
description: 'Operate the Mum''s Bookshelf GitHub repository and Cloudflare services. Use when inspecting or changing git history, diffs, branches, commits, pushes, pull requests, reviews, GitHub Actions, repository settings, workflow configuration, Cloudflare Worker settings, or the author-library D1 database.'
argument-hint: 'Describe the repository, GitHub, GitHub Actions, Worker, or D1 task.'
---

# Mum's Bookshelf Repository Operations

Use this skill for end-to-end repository operations for `Arniox/Mums-Bookshelf`.

## Repository Facts

- The canonical remote is `https://github.com/Arniox/Mums-Bookshelf.git`; the default branch is `main`.
- This is an npm workspaces monorepo: Astro web app in `apps/web`, Hono Cloudflare Worker API in `apps/api`, and shared code in `packages/shared`.
- The Worker configuration is [apps/api/wrangler.jsonc](../../../apps/api/wrangler.jsonc). It uses the `author-library` Cloudflare D1 database.
- Pushing to `main` runs `.github/workflows/deploy-pages.yml`, which validates the repo, applies remote D1 migrations, deploys the Worker, and deploys GitHub Pages.
- `.github/workflows/deploy-worker.yml` is a manual Worker deployment workflow that also applies remote D1 migrations.

## Safety Rules

1. Start every task with read-only state: `git status --short --branch`, `git remote -v`, and the smallest relevant diff, log, workflow, or Cloudflare query.
2. Do not overwrite, discard, stash, reset, rebase, force-push, or otherwise erase user work unless the user explicitly requests that exact operation.
3. Treat these as remote mutations requiring explicit confirmation immediately before execution: `git push`, merging or closing a pull request, creating or editing releases/tags, changing repository settings/secrets/variables/environments/branch rules, cancelling or re-running workflows, applying remote D1 migrations, D1 writes, Worker secret/config changes, and Worker deployment.
4. Creating a local commit is allowed only when the user asked to commit or clearly asked to finish a change. Before committing, show the staged diff, identify the exact files, and run focused validation.
5. Never reveal, print, commit, or request secret values. Use secret-aware prompts such as `wrangler secret put` only after confirmation, and ask the user to type secrets directly into an interactive terminal when required.
6. Use scoped Cloudflare credentials and GitHub permissions. Do not change access controls, tokens, secrets, deployment environments, or production data incidentally.

## Standard Workflow

1. Identify the narrow goal and affected surface: Git history/content, pull request, Actions, repository configuration, Worker, or D1.
2. Gather only the relevant read-only facts. Preserve unrelated working-tree changes.
3. Explain the intended change, its production effect, and validation command before editing files or making a remote request.
4. For source changes, make the smallest edit, then run the closest applicable check:
   - all packages: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`
   - Worker/API: `npm run typecheck -w @mums-bookshelf/api`, `npm run test -w @mums-bookshelf/api`, `npm run build -w @mums-bookshelf/api`
   - web: `npm run typecheck -w @mums-bookshelf/web`, `npm run test -w @mums-bookshelf/web`, `npm run build -w @mums-bookshelf/web`
5. Summarize exactly what changed and what validation passed. Request confirmation at the action boundary before any remote mutation.

## Git And GitHub Operations

### Inspect And Summarize

- Use `git status`, `git diff`, `git diff --staged`, `git log`, and `git show` to explain local and remote changes precisely.
- Use `gh repo view`, `gh pr view/list/diff`, `gh run list/view`, `gh variable list`, and `gh secret list` for GitHub state when the GitHub CLI is authenticated. Fall back to the GitHub API only when required.
- Name uncommitted or unexpected changes before proceeding. Never include them in a commit unless the user explicitly asks.

### Commit And Push

1. Check the branch, status, and staged/unstaged diff.
2. Stage only files belonging to the requested task with explicit paths, never `git add .` by default.
3. Run focused validation and report any failures.
4. Create a concise imperative commit message only after the user asked to commit.
5. Before pushing, state the target branch and warn that pushing `main` deploys Pages and the Worker and applies pending remote D1 migrations. Obtain confirmation, then use a normal non-force push.

### Pull Requests And Reviews

- For reviews, lead with concrete correctness, security, deployment, migration, and missing-test findings, ordered by severity and linked to files.
- For a pull request, inspect its diff, checks, changed workflows, migration files, and deployment implications before recommending merge.
- Creating, editing, merging, closing, or requesting reviewers on a pull request changes GitHub state; ask for confirmation immediately before doing so.

### GitHub Actions And Configuration

- Inspect workflow YAML locally first, then use `gh run` to examine runs, logs, and job failures.
- Treat workflow dispatch, reruns, cancellations, and repository configuration changes as confirmed remote actions.
- Keep `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets. Public `PUBLIC_*` build configuration belongs in GitHub Actions variables, not secrets.
- Review any proposed workflow change for least-privilege permissions, pinned actions, Node 24 compatibility, lockfile installation via `npm ci`, and the existing validation sequence.

## Cloudflare Worker And D1 Operations

1. Before Cloudflare work, load the applicable Cloudflare skill. Load `wrangler` before invoking Wrangler commands; load `workers-best-practices` for Worker code/configuration; use `cloudflare` for platform and account-level tasks.
2. Read [apps/api/wrangler.jsonc](../../../apps/api/wrangler.jsonc), relevant migrations, and the API schema before forming a D1 query or config change.
3. Prefer read-only D1 inspection first: `npx wrangler d1 execute author-library --remote --command "SELECT ..." --config apps/api/wrangler.jsonc`.
4. Limit queries to needed columns and rows. Do not expose drafts, user sessions, password hashes, refresh tokens, IP hashes, comments awaiting moderation, or other personal data in chat output.
5. D1 updates, deletes, schema changes, imports, remote migration application, Worker deploys, secrets, routes, and environment-variable changes require a pre-execution confirmation that names the environment and expected effect.
6. Apply migrations before deploying an API release that depends on new fields. The preferred validated path is `npm run db:migrate:remote` followed by `npm run deploy:api`.
7. After an approved deployment, verify the health surface with a minimal public endpoint such as `GET /api/v1/works`, without modifying data.

## Completion Criteria

- The requested GitHub, source, workflow, Worker, or D1 state is verified against the intended target.
- Relevant validation has run and results are reported.
- Any remote mutation was explicitly confirmed immediately before it ran.
- The final summary distinguishes local changes, committed changes, pushed changes, workflow/deployment effects, and any remaining follow-up.