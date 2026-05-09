# Changelog

All notable changes to AgentSync will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Status: alpha.** APIs may change without notice between 0.x releases. We will document breaking changes here.

## [Unreleased]

## [0.1.0] — initial open-source release

### Added

#### Server: auth & onboarding
- Agent-key challenge / sign / register flow with Ed25519 keys.
- OIDC SSO (`/v1/auth/sso/start`, `/v1/auth/sso/callback`) with PKCE; supports any OIDC-compliant issuer (Google Workspace, Microsoft Entra, Okta, Authentik, Keycloak).
- Email/OTP verification via pluggable provider (`console`, `resend`, `smtp`, `ses`).
- Bootstrap super-admin via `BOOTSTRAP_ADMIN_EMAIL`, with one-time setup-token fallback printed at first server start.
- Domain allowlist via `SIGNUP_ALLOWED_DOMAINS`.

#### Server: MCP & OAuth spec compliance
- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `WWW-Authenticate: Bearer realm="agentsync", resource_metadata="..."` on `/mcp` 401.
- Dynamic Client Registration (`POST /oauth/register`) with PKCE-only public clients.
- Server-rendered HTML OAuth consent page with role permissions translated to plain English.

#### Server: data
- 6-layer permission engine (user → workspace → table → action → record → field).
- `record_revisions` table, automatic revisioning on create/update/delete, `POST /v1/records/:id/revert`, `GET /v1/records/:id/revisions`. 7-day retention.
- `GET /v1/explain` — plain-English summary of team / blueprint / role.
- Per-team starter prompt + agent kit generator.
- Schema-from-description wizard via Anthropic (optional, gated by `ANTHROPIC_API_KEY`).
- Suggestion service: agents propose schema changes that admins approve.

#### Server: admin
- Super-admin gated routes: `/v1/admin/diagnostics`, `/v1/admin/metrics`, `/v1/admin/teams`.

#### Web app (`apps/web`, Next.js 15)
- `/` landing, `/sign-in` (auto-detects SSO), `/sso/complete`, `/connect` (one-click MCP URL copy), `/invite/[code]`, `/setup` (first-run wizard).
- `/app` shell with team-scoped table view (inline editing, type-aware editors, transition-aware select), provenance sidebar, revision list, undo/revert toast.
- `/app/blueprints` gallery + `/app/blueprints/new` describe-what-you-track wizard.
- `/app/schema` browser, `/app/members` with magic-link invites, `/app/suggestions` approval queue.
- `/admin` console for super-admins (health, usage, teams).

#### Self-host kit
- Production Docker compose (`docker/docker-compose.prod.yml`) with Caddy auto-TLS.
- Multi-stage Dockerfiles for the server (`docker/Dockerfile.server`) and web (`apps/web/Dockerfile`).
- Helm chart (`deploy/helm/agentsync/`) with optional bundled Postgres/Redis or external connection strings.
- Operator docs: `docs/deploy/ENV.md`, `DEPLOY.md`, `BACKUP.md`, `UPGRADE.md`.

#### SDK (`@agentsync/sdk`)
- `records.revisions()`, `records.revert()` added to the typed resource API.

### Internal

- Split `packages/server/src/mcp/tools/index.ts` (1,391 lines) into per-domain modules.
- Pluggable email provider abstraction with adapters for Resend, SMTP (nodemailer), AWS SES, and a console provider for development.
- Request-ID middleware (`X-Request-Id` propagation).
- Plain-English error catalog (`packages/server/src/utils/errors.ts`).
- 304 unit/integration tests across `types`, `db`, `sdk`, and `server`.
- CI workflow (lint / typecheck / test / build).
- Tag-triggered release workflow that publishes Docker images to GHCR.
- Dependabot for npm, GitHub Actions, and Docker.

### Known limits

- `pnpm lint` reports 313 warnings (mostly `noExplicitAny` / `noNonNullAssertion`); CI gates only on errors. Cleanup is a follow-up.
- The web sign-in form's email path is informational only — real password / magic-link flow ships next; today, sign-in goes through SSO or an MCP-capable agent.
- "Rotate JWT secret" is a manual restart in 0.1; grace-window rotation is planned.

[Unreleased]: https://github.com/amrshawqy/agentsync/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/amrshawqy/agentsync/releases/tag/v0.1.0
