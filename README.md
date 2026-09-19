# Project Management — Server

NestJS REST API backend. React client lives in the sibling `client` folder/repo.

## Stack

- **Framework:** NestJS 12 (ESM + Vitest)
- **Database:** PostgreSQL 17, accessed via **Prisma 7** (pinned to the stable `7.x` line — do **not** upgrade to `8.x` while it's still a release candidate)
- **Auth:** WebAuthn/Passkeys (`@simplewebauthn/server`) as primary, email+password (`argon2`) as fallback; JWT access tokens + rotating refresh tokens (httpOnly cookie)
- **Linting:** Oxlint

## Prerequisites

- Node.js **24.19+** (LTS)
- npm **12+**
- PostgreSQL **17** running locally (a real server — see below, not `npx prisma dev`)

## First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Approve native install scripts (needed for argon2's native binary and
#    Prisma's engine binaries to build correctly)
npm install-scripts approve argon2
npm install-scripts approve @prisma/engines prisma

# 3. Create the local databases (main + shadow, used by Prisma Migrate)
psql -U postgres -h localhost -c "CREATE DATABASE project_management_dev;"
psql -U postgres -h localhost -c "CREATE DATABASE project_management_shadow;"

# 4. Copy the env template and fill in real values
cp .env.example .env

# 5. Apply the schema and generate the Prisma client
npx prisma migrate dev
```

## Running the app

```bash
npm run start:dev     # watch mode, day-to-day dev
npm run build          # compile to dist/
npm run start:prod     # run the compiled build
```

## Tests

```bash
npm run test           # unit tests (Vitest)
npm run test:cov       # with coverage
```

## Environment variables

See `.env.example` for the full list. Notable ones:

| Var                                  | Purpose                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                       | Postgres connection string                                                                        |
| `JWT_ACCESS_SECRET`                  | Signs access tokens — generate a real random value before deploying anywhere real                 |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` | Must match your actual domain in production; `localhost` only works for local dev over plain HTTP |
| `CLIENT_ORIGIN`                      | Used for CORS — must match wherever the React client is actually running                          |
| `CLOUDINARY_*`                       | Task file attachments. Required at boot — the app won't start without them                        |

## API versioning

All business routes are prefixed `/api/v1/` (global prefix `api` + URI versioning, set as the default in `main.ts`) — e.g. `POST /api/v1/auth/login/password`, `GET /api/v1/workspaces`. `GET /` and `GET /health` are deliberately excluded from both the `api` prefix and versioning (`VERSION_NEUTRAL`) and public, since infra tooling (load balancers, uptime monitors) hitting a health check shouldn't need to know or care about API prefixes/versions.

## Deployment

Deployed via [Northflank](https://northflank.com) (free tier — chosen over Render/Koyeb, which sleep on inactivity, and over Fly.io, which dropped its free tier in 2024; a sleeping backend can't hold WebSocket connections open). Northflank builds and runs the repo's `Dockerfile` directly on every push to `develop` (native Git integration — GitHub Actions is CI-only here, not the deploy mechanism).

**Northflank setup (one-time, via their dashboard):**

1. Create a free account, create a project, add a service from this GitHub repo.
2. Build type: Dockerfile (uses the repo's `Dockerfile` as-is).
3. Branch to track: `develop`.
4. Port: `3000` (matches `EXPOSE 3000` in the `Dockerfile`).
5. Set these environment variables/secrets in the Northflank dashboard (never commit them):

   | Var                 | Value                                                                |
   | ------------------- | -------------------------------------------------------------------- |
   | `NODE_ENV`          | `production`                                                         |
   | `DATABASE_URL`      | Neon pooled connection string                                        |
   | `JWT_ACCESS_SECRET` | freshly generated random value, not the local-dev one                |
   | `WEBAUTHN_RP_ID`    | the production domain (e.g. `your-app.vercel.app`), no protocol/port |
   | `WEBAUTHN_ORIGIN`   | the production origin, e.g. `https://your-app.vercel.app`            |
   | `CLIENT_ORIGIN`     | same as `WEBAUTHN_ORIGIN` — used for CORS                            |
   | `CLOUDINARY_*`      | production Cloudinary credentials                                    |

6. After the first successful deploy, run `npx prisma migrate deploy` against the Neon database (from a local machine with `DATABASE_URL` pointed at Neon, or via Northflank's one-off job/shell feature) — this Dockerfile copies `prisma/` into the runtime image for exactly this purpose but does not run migrations automatically on boot.
7. Once Vercel's URL is known, come back and correct `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`/`CLIENT_ORIGIN` if they were set as placeholders first.

**Branch protection** (manual, no `gh` CLI needed): GitHub repo → Settings → Branches → Add branch protection rule → branch name pattern `develop` → enable "Require status checks to pass before merging" → search for and select `build-and-test` (this repo's CI job name) → Save. This makes CI a real gate: a PR can't merge into `develop` (and therefore can't trigger a Northflank deploy) while lint/format/build/test are failing.

## Viewing data

Prisma Studio (`npx prisma studio`) has a known, currently-unpatched bug on Windows + PostgreSQL ([prisma/prisma#29348](https://github.com/prisma/prisma/issues/29348)) — it fails to load schema metadata. Use **pgAdmin** instead: register a server pointing at `localhost:5432`, credentials as in `.env`.

## Project structure

Standard NestJS `core` / `common` / `modules` layout:

```
src/
  common/                 # zero/light-dependency, reused by every module
    decorators/           # @CurrentUser, @Public, @Roles
    guards/                # JwtAuthGuard, RolesGuard (registered globally)
  core/                   # app-wide infrastructure (each carries a real dependency)
    prisma/                # PrismaService — DB connection
    workspace-access/      # shared role/workspace-resolution logic
    logger/                 # Winston logger
    cloudinary/             # file storage integration
  modules/                # one folder per feature domain
    auth/
    workspaces/
    projects/
    tasks/
    comments/
    subtasks/
    attachments/
    activity-log/
    realtime/
    health/
  generated/prisma/       # auto-generated Prisma client (gitignored, untouched by the above)
  app.module.ts
  main.ts
prisma/
  schema.prisma           # data model — source of truth
  migrations/             # auto-generated SQL history, committed to git
```

**Rule of thumb for where new code goes:** if it's only used by one feature, it belongs in that feature's folder under `modules/`. If it's reused across features but carries a dependency (DB, third-party API), it belongs in `core/`. If it's a lightweight, dependency-free cross-cutting piece (a decorator, a guard, a pipe), it belongs in `common/`.
