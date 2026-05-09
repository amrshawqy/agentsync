# Contributing

Thanks for your interest in AgentSync. This guide gets you from a fresh clone to a green PR.

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating you agree to abide by it.

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities. Use [GitHub Security Advisories](https://github.com/amrshawqy/agentsync/security/advisories/new) instead. See [SECURITY.md](./SECURITY.md).

## Prerequisites

- Node.js 20+ (CI runs Node 22)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Docker Desktop (for the Postgres + Redis dev stack)

## Get the code running

```bash
git clone https://github.com/amrshawqy/agentsync.git
cd agentsync
pnpm install
docker compose -f docker/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm --filter @agentsync/server dev
# in a second terminal:
pnpm --filter @agentsync/web dev
```

The server is on `http://localhost:3000`, the web app on `http://localhost:3001`.

If port 6379 (Redis) or 5432 (Postgres) is already in use locally, override:

```bash
REDIS_PORT=6385 POSTGRES_PORT=5435 docker compose -f docker/docker-compose.yml up -d
```

## Project layout

```
packages/
  types/   # shared zod schemas + TypeScript types
  db/      # drizzle schema, migrations, seed
  server/  # Hono REST + MCP + business services
  sdk/     # typed JavaScript/TypeScript SDK
apps/
  web/     # Next.js end-user UI
blueprints/  # built-in blueprints (CRM, HR, etc.)
docs/        # vision, architecture, deploy docs
deploy/helm/ # Helm chart
docker/      # dev + prod compose, Dockerfiles
```

## Workflow

1. **Open an issue first** for non-trivial changes so we can agree on scope before code is written.
2. **Branch from `main`**, name it `<short-topic>` (e.g. `fix-revert-permission`).
3. **Make focused commits.** Keep refactors out of feature PRs where possible.
4. **Run the local checks** before pushing:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
5. **Open a PR** against `main` using the template. CI will run the same checks.

## Code style

- Tabs for indentation, single quotes, semicolons. 100-character line width. Biome enforces it (`pnpm format`).
- ESM only. Imports in TypeScript files use `.js` extensions (because of `"moduleResolution": "bundler"` + Node ESM at runtime).
- Prefer `unknown` over `any`. If `any` is unavoidable, leave a comment explaining why.
- No comments that just describe what the code does. Comments are for the *why* — non-obvious constraints, hidden invariants, workarounds.

## Tests

- Unit + integration tests live next to the package (`packages/<name>/test/`). Vitest is the runner.
- Add a test for any bug fix and any new code path. The bar is "future me would want this test."
- For changes that touch the data path, please run an end-to-end smoke (create record → update → revert) against a local dev compose before opening the PR.

## Database changes

- Schema changes go in `packages/db/src/schema/*.ts` plus a hand-written SQL file under `packages/db/drizzle/` and a journal entry. The migration runner is plain Drizzle (no rollbacks); make migrations additive.
- If you add a new env var, update `.env.example` and `docs/deploy/ENV.md` in the same PR.

## Documentation changes

- User-facing changes need at least a CHANGELOG entry under "Unreleased".
- Deploy / operator changes need a corresponding update in `docs/deploy/`.
- Public APIs need an entry in the SDK or REST surface that's discoverable from the README.

## Release process (maintainers)

1. Update `CHANGELOG.md` — promote "Unreleased" entries under a new version heading.
2. Bump versions in package.json files where applicable.
3. Tag the commit `vX.Y.Z` and push the tag. The release workflow builds and publishes Docker images to GHCR.

## Getting help

- Open a Discussion for "how do I…" questions.
- Open an Issue for bugs or concrete proposals.
- Real-time chat: TBD.
