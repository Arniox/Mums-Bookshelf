# Mum's Bookshelf

A small author website with a warm, animated CSS bookshelf and a private editorial studio. The public site is static and deploys to GitHub Pages. Published content, sessions, settings, and moderated comments live in Cloudflare D1 behind a Cloudflare Worker API.

The included fictional author and works are demonstration content and can be replaced through `/admin/`.

## Architecture

```text
Visitor ──> GitHub Pages (Astro static HTML, CSS, minimal JS)
                         │
                         ├── public reads/comments ──> Cloudflare Worker ──> D1
Author ──> /admin/ ──────┘            │
                                     └── PBKDF2 passwords, JWT access token,
                                         rotating/revocable server session
GitHub Actions build ──> public Worker API ──> generates clean /works/slug/ pages
```

- `apps/web`: Astro static site, deterministic CSS bookshelf, accessible list, public pages, author studio, RSS, sitemap and SEO.
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

1. Deploy the D1 migrations and Worker.
2. Add the Worker URL and Pages configuration as GitHub Actions variables.
3. Push to `main`; `.github/workflows/deploy-pages.yml` validates and deploys the site.
4. Run the Worker workflow manually when the API changes.

See [SETUP.md](SETUP.md) for the complete beginner-friendly process and [SECURITY.md](SECURITY.md) before accepting real comments or content.
