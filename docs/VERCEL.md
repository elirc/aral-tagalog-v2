# Test and deploy on Vercel

Deploy one Next.js project with the existing API at `/api`. Accounts and progress
use managed PostgreSQL; lessons also work as a guest. Docker is an alternative,
not a prerequisite for this deployment.

## 1. Prepare the database

Create a PostgreSQL database through Vercel Marketplace, for example Neon. Place
it near the Vercel function region (`iad1`, Northern Virginia, in
`apps/web/vercel.json`). Use the provider's **pooled connection URL** for the app.
Keep TLS enabled. Use a separate database/branch for preview testing so tests
cannot change production progress.

Run migrations once against that database from this repository, using Node 24
and the pinned pnpm version:

```sh
corepack enable
pnpm install --frozen-lockfile
DATABASE_URL='YOUR_DIRECT_POSTGRES_URL' pnpm db:migrate
```

For PowerShell:

```powershell
$env:DATABASE_URL = 'YOUR_DIRECT_POSTGRES_URL'
corepack pnpm db:migrate
Remove-Item Env:DATABASE_URL
```

Use the provider's direct URL for migrations when available. Migrations are
explicit; preview builds never migrate or overwrite a production database.

## 2. Import the repository

In Vercel, import the release branch and choose:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | `apps/web` |
| Include source files outside Root Directory | Enabled |
| Node.js | 24.x |
| Install command | Use `apps/web/vercel.json` |
| Build command | Use `apps/web/vercel.json` |

The build runs workspace dependencies before Next.js and copies the current
course bundle to static assets. Large course downloads redirect to `/_course/`
and are served by Vercel's CDN, avoiding the function response-size limit.

Set these environment variables in Vercel for **Preview** first:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Preview database's pooled PostgreSQL URL |
| `JWT_SECRET` | A newly generated secret, at least 32 bytes |
| `NEXT_PUBLIC_API_URL` | `/api` |

Generate a secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Keep database URLs and `JWT_SECRET` server-only. Do not prefix them with
`NEXT_PUBLIC_`. The web/API share an origin, so no `CORS_ORIGIN` is needed. Keep
the same production JWT secret between deployments to preserve sessions.

## 3. Test the preview

Open the Vercel preview URL. Keep deployment protection enabled for your private
test if desired and sign in through Vercel to access it.

1. At a narrow/mobile width, choose each of the four tiers, move between course
   pages, and open both an existing lesson and a newly added one.
2. Complete a lesson as a guest. Reload and check that XP and completion remain.
3. Register an account. Confirm guest progress merges. Sign out and sign back in.
4. Open a second tab. Complete another lesson and check that progress converges
   after the first tab regains focus.
5. Disconnect the network, finish a lesson, reconnect, and check that sync clears
   without losing progress. Exercise wrong answers and the review queue too.
6. Check word search, daily goals, statistics, theme settings, and speech/audio
   on the browser/device you will use.
7. Visit `/api/ready`; it should return `{"ok":true}`. Check the Vercel function
   logs if it returns 503 (typically missing configuration or migrations).

For an unprotected preview, run the automated account test from your checkout:

```sh
SMOKE_API_URL=https://YOUR_PREVIEW.vercel.app/api pnpm smoke
SMOKE_WEB_URL=https://YOUR_PREVIEW.vercel.app node scripts/vercel-smoke.mjs
```

The account test creates a throwaway user. With deployment protection, use the
manual browser checklist or the bypass mechanism configured in your Vercel
project; do not publish a bypass token in source or browser environment variables.

For local testing, build with `pnpm release:check`, copy
`apps/web/.env.example` to `apps/web/.env.local`, configure a test database, run
migrations, and start `pnpm --filter @aral/web start`. Open
`http://localhost:3000`. Guest lessons can be tried before connecting a database.

## 4. Deploy production

After accepting the preview, configure the **Production** variables with the
production database and its own secret. Migrate that database, then deploy the
reviewed revision to Production in Vercel. Recheck `/api/ready`, registration,
one lesson, and a reload. Add a custom domain in Vercel if wanted.

Use managed database backups and take a backup before later migrations. A Vercel
deployment rollback restores application code and content; it does not undo
database migrations. Keep the app region and database region close together.

The current small release has no self-service password reset or email
verification. Recorded audio is incomplete; browser speech synthesis supplies
the fallback when a suitable voice exists. Content received structural checks
and a targeted grammar/translation review; fluent-speaker testing is valuable
before using the entire expanded curriculum with learners.

References: [Vercel monorepos](https://vercel.com/docs/monorepos),
[function limits](https://vercel.com/docs/functions/limitations),
[Next.js API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes).
