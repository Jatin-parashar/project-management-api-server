# syntax=docker/dockerfile:1

# --- deps: full install (argon2's prebuilt binary + Prisma's engines are
# fetched here via the install scripts already allow-listed in package.json's
# `allowScripts` field — no compiler toolchain needed, argon2 ships prebuilt
# binaries for standard Linux glibc targets) ---
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: generate the Prisma client, then compile TypeScript. The
# generated client (src/generated/prisma) gets compiled into dist/ alongside
# everything else, so nothing Prisma-specific needs regenerating later. ---
FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --config prisma7.config.ts
RUN npm run build

# --- production-deps: same install, minus devDependencies, for a smaller
# final image ---
FROM node:24-slim AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime: the actual image that runs in production ---
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--disable-warning=ExperimentalWarning

COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# prisma/ (schema + migrations) is kept in the runtime image so `npx prisma
# migrate deploy` can still be run inside the container as a one-off command
# when the schema changes — not run automatically on every boot.
COPY --from=build /app/prisma ./prisma
COPY package.json prisma7.config.ts ./

RUN useradd --system --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
CMD ["node", "dist/main.js"]
