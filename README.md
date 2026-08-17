# Mum's Bookshelf

**[Visit Mum's Bookshelf](https://denisediehl.com/)**

A small author website with a warm, animated CSS bookshelf and a private editorial studio. The public site deploys to GitHub Pages, where its static HTML provides a resilient fallback and SEO surface. Published works are refreshed from the Cloudflare Worker API in the browser, while content, sessions, settings, and moderated comments live in Cloudflare D1.

The studio keeps local recovery drafts, supports private online drafts from any device, and publishes works immediately through D1. Publishing automatically starts a background GitHub Pages refresh for static work pages, the sitemap, RSS, and social metadata; it does not delay readers seeing the new work.

The included fictional author and works are demonstration content and can be replaced through `/admin/`.

## Architecture

```text
Visitor ──> GitHub Pages (Astro static fallback, CSS, minimal JS)
                         │
                         ├── live published reads/comments ──> Cloudflare Worker ──> D1
Author ─> /admin/ ──────┘                         │
                                                  └── PBKDF2 passwords, JWT access token,
                                                      rotating/revocable server session
GitHub Actions background build ──> Worker API ──> static work pages, RSS and sitemap
```

- `apps/web`: Astro site with a static fallback and runtime public-work refresh, deterministic CSS bookshelf with individual spine marks and new-release shelf glow, accessible list, author studio, RSS, sitemap and SEO.
- `apps/api`: Hono Worker, D1 queries, authentication, moderation, export and versioned API.
- `packages/shared`: Zod models, content helpers, Markdown sanitisation and deterministic book appearance.

The public build uses the API when `PUBLIC_API_BASE_URL` is a deployed URL. With no deployed API during initial local development, it uses the fictional sample data in `apps/web/src/data/sample.ts`.

## Commands

```bash
npm install
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Useful focused commands:

```bash
npm run dev:web
npm run dev:api
npm run db:migrate:local
npm run db:seed:local
npm run admin:create -- author
npm run deploy:api
```

## Deployment

1. Configure `denisediehl.com` in GitHub Pages and at the domain registrar.
2. Deploy the D1 migrations and Worker.
3. Add the Worker URL and custom-domain configuration as GitHub Actions variables.
4. Push to `main`; `.github/workflows/deploy-pages.yml` validates and deploys the site.
5. Run the Worker workflow manually when the API changes.

See [SETUP.md](SETUP.md) for the complete beginner-friendly process and [SECURITY.md](SECURITY.md) before accepting real comments or content.
