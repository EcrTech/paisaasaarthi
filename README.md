# Paisaa Saarthi LOS

Loan origination system covering the application-to-disbursement flow for In-Sync's lending operations: lead intake, KYC, eligibility, sanction, document collection, disbursement, and collections.

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + shadcn-ui (PWA via vite-plugin-pwa)
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth + Storage)
- **Hosting:** Cloudflare Pages
- **Integrations:** Exotel (telephony), WhatsApp Business, Resend (email), Mapbox, Aadhaar/KYC providers, Nupay (payments), credit bureau APIs

## Local Development

```sh
npm install
npm run dev          # http://localhost:8080
npm run build        # outputs to dist/
npm run lint
npm test             # vitest
```

`.env` (gitignored) must contain at minimum:

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-jwt>
VITE_SUPABASE_PROJECT_ID=<ref>
```

For deploys, also include:

```env
CLOUDFLARE_API_TOKEN=cfut_...
CLOUDFLARE_ACCOUNT_ID=...
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # server-only, never bundled
SUPABASE_DB_PASSWORD=...
GITHUB_TOKEN=ghp_...
```

Only values prefixed `VITE_` are inlined into the browser bundle. Anything that grants write access (service role key, sbp_ token, Cloudflare API token, GitHub token) must NOT be prefixed `VITE_`.

## Deploy — Frontend (Cloudflare Pages)

The frontend ships directly from a local working tree using Wrangler. There is no GitHub Actions step for the frontend; pushing code does not deploy it.

```powershell
npm run build
Set-Content -Path dist\_redirects -Value "/*  /index.html  200"
wrangler pages deploy dist --project-name=ps-sync --branch=main
```

The Cloudflare Pages project is `ps-sync`, served at `https://ps-sync.pages.dev`. The custom domain `ps.in-sync.co.in` points at it via a proxied CNAME on the `in-sync.co.in` zone.

## Deploy — Supabase (CI)

Migrations and edge functions deploy automatically on push to `main` when files under `supabase/**` change. See `.github/workflows/supabase-deploy.yml`.

Required GitHub Actions secrets:

- `SUPABASE_ACCESS_TOKEN` (`sbp_…`)
- `SUPABASE_DB_PASSWORD`
- `VITE_SUPABASE_PROJECT_ID`

## Custom Domain

Production: `https://ps.in-sync.co.in`

DNS is managed in Cloudflare; the record is a proxied CNAME pointing at `ps-sync.pages.dev`.

## Rollback

Forward-rollback (bad new deploy, Pages itself fine): use the Cloudflare Pages dashboard to roll back to a previous deployment of `ps-sync`.

Full rollback to Azure: not available — there is no prior Azure SWA deployment for this app (it was a fresh Cloudflare Pages deploy).
