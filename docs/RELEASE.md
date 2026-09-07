# Small production release

The supplied deployment runs one Next.js web process, one Fastify API, one
PostgreSQL database, and Caddy on one Linux host. Caddy supplies HTTPS and routes
`/api/*` to Fastify. Only ports 80 and 443 are public. The database and TLS
certificates use persistent Docker volumes. Brief maintenance downtime is
acceptable for this release; no load balancer or distributed cache is needed.

## Prepare the release

Use Node 24 and the pinned pnpm version (`corepack enable`). Run:

```sh
pnpm install --frozen-lockfile
pnpm release:check
```

This audits production dependencies, runs unit tests, validates and compiles all
course content, typechecks all packages, and builds the web app. The GitHub
`Release checks` workflow also builds
the actual Docker images, migrates a fresh Postgres database, runs database
integration tests, exports Android and iOS production bundles, and exercises
account/progress flows through Caddy over verified HTTPS. CI uses Caddy's local
certificate authority with an explicit test CA file; TLS verification stays on.
Set `TEST_DATABASE_URL` to an **isolated test database** to run those integration
tests locally; they are skipped when it is unset.

Before inviting users, review the course with a fluent Tagalog speaker and try a
lesson, the audio fallback, registration, logout/login, and offline reconnection
on the browsers/devices you intend to support. Some course material is generated
and recorded audio is incomplete; speech synthesis depends on installed voices.

## First deployment

On a Linux host with Docker Engine and Docker Compose v2 installed, check out the
reviewed release and point a domain's DNS records at the host. Allow inbound TCP
80/443 (and optionally UDP 443); keep database/API/web ports private.

```sh
cp .env.production.example .env.production
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Edit `.env.production`: set `DOMAIN` to the bare hostname and use the two generated
values for `POSTGRES_PASSWORD` and `JWT_SECRET`. The password must be URL-safe
because Compose includes it in `DATABASE_URL`. Keep this file private and backed
up securely. Do not reuse the development credentials.

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d --wait --wait-timeout 180
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl --fail https://YOUR_DOMAIN/api/ready
SMOKE_API_URL=https://YOUR_DOMAIN/api pnpm smoke
SMOKE_WEB_URL=https://YOUR_DOMAIN SMOKE_HTTP_URL=http://YOUR_DOMAIN node scripts/proxy-smoke.mjs
```

The one-shot migration service must succeed before the API starts. The API must
pass a database/content readiness check before the web and proxy start. If DNS or
certificate issuance is still pending, inspect the proxy logs and retry HTTPS.
The smoke suite **creates a throwaway account and progress**; run it knowingly.

Keep the same checkout directory and Compose project name (`aral`) for updates so
the deployment keeps using its existing data volumes. Never run `down -v` on the
production stack: that deletes its volumes.

## Back up and restore

Back up daily and before every release. These commands use a Linux shell; the
custom-format dump is binary and should not be redirected by Windows PowerShell
5.1. Keep an encrypted copy away from this host and periodically test a restore.

```sh
mkdir -p backups
chmod 700 backups
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db pg_dump -U aral -d aral -Fc > "backups/aral-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Verify a backup by restoring it into a **new empty database**, leaving the live
database alone:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db createdb -U aral aral_restore_check
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db pg_restore -U aral -d aral_restore_check --no-owner --exit-on-error < backups/YOUR_BACKUP.dump
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db psql -U aral -d aral_restore_check -c 'SELECT count(*) FROM users; SELECT count(*) FROM progress_events;'
```

If recovery is necessary, stop `api web proxy`, restore into a fresh database,
validate it, then point both API and migrations at that database and restart.
Retain the damaged database until recovery is confirmed.

## Update and rollback

1. Note the current Git revision and image IDs; make and verify a backup.
2. Fetch the reviewed release and build images before interrupting users.
3. Stop `api web proxy`, leaving `db` running.
4. Run migrations once, then recreate the app and check readiness:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml stop api web proxy
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps --force-recreate --wait --wait-timeout 180 api web proxy
```

Rebuild the web and restart the API together whenever content changes. For an
application-only rollback, check out the previous revision, rebuild, and recreate
the app. A database rollback needs an explicitly tested reverse migration or a
backup restore; an older image alone does not undo schema changes. Restoring an
older backup discards progress recorded after that backup.

## Operations and alternate hosting

- Monitor `https://YOUR_DOMAIN/api/ready`. `/health` only checks process liveness.
- Inspect failures with `docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 api web proxy`. Logs rotate automatically.
- Monitor free disk space and verify backups. Retain a small rotation of releases
  and backups; persistent volumes do not protect against disk failure.
- For separate web/API hosts, set `NEXT_PUBLIC_API_URL` to the API's HTTPS URL
  **before the web build** and `CORS_ORIGIN` to the exact web origin. This public
  build variable is included in the Turbo cache key. Set `TRUST_PROXY=true` only
  behind a trusted proxy that overwrites forwarded client IP headers.
- Mobile builds need `EXPO_PUBLIC_API_URL=https://YOUR_DOMAIN/api`. Production
  config rejects an absent, insecure or loopback API URL. App-store submission,
  signing and real-device validation are separate from this web deployment.
- This release uses email/password accounts without self-service password reset
  or email verification. Confirm that limitation is acceptable to your small
  invited group before launch.

The 2026-09-07 production dependency audit reports zero advisories across web,
API, and mobile. `pnpm security:audit` is enforced by `pnpm release:check`.
Scoped overrides remove Drizzle's unused Expo adapter, update PostCSS and Xcode's
UUID dependency, and use two small compatibility packages under `vendor/`.
The [image parser fork](../vendor/image-size/README.md) fixes malformed-file
infinite loops in Metro's archived dependency; the
[URI decoder compatibility build](../vendor/decode-uri-component/README.md)
preserves Expo's CommonJS interface using the official fixed decoding algorithm.
Both retain upstream licenses and provenance. Mobile tests exercise the installed
consumer chains, malicious input, and normal supported behavior. Review these
local packages when updating Expo and remove them when upstream dependencies
provide compatible fixes.

The proxy follows [Caddy's path-routing documentation](https://caddyserver.com/docs/caddyfile/directives/handle)
and [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting).
