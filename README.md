# AgentSync

[![CI](https://github.com/amrshawqy/agentsync/actions/workflows/ci.yml/badge.svg)](https://github.com/amrshawqy/agentsync/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](./CHANGELOG.md)

**One self-hosted data layer your AI agents share.** Drop in any MCP-capable agent (Claude Desktop, Cursor, Cline, Continue, OpenClaw…), point it at your AgentSync URL, and it can read and write structured business data — contacts, deals, tickets, anything you model — under role-based permissions, with full audit and provenance.

> 🚧 **Alpha software.** APIs and schemas may change between 0.x releases. Track [CHANGELOG.md](./CHANGELOG.md). Not yet recommended for unattended production use.

## For AI agents

If you are an agent (or pointing one at this server), read **[SKILL.md](./SKILL.md)** — a single self-contained guide to install, connect, set up, and operate AgentSync end-to-end. Every running deployment also serves it live at `<your-base-url>/skill.md`, so you can tell a teammate's agent: "go to `https://agentsync.acme.com/skill.md`" and it will pick up everything from there.

## What you get

- **One MCP URL** — paste it into any agent. The agent triggers the standard OAuth flow on first use; users see a familiar browser sign-in.
- **Schema-first data model** — tables, fields with types and constraints, state-machine transitions, and field-level provenance (`who`, `when`, `confidence`).
- **Multi-tenant, multi-workspace** — Postgres RLS keyed per team; one server hosts many teams.
- **Built-in blueprints** — CRM, HR, PM, support, finance, inventory; one-click deploy. Or describe your business in plain English and have AgentSync draft a custom blueprint.
- **Web UI for non-technical users** — table view with inline edit, undo, provenance sidebar, schema browser, blueprint gallery, member invites.
- **Operator kit** — Docker Compose, Helm chart, OIDC SSO, pluggable email (Resend/SMTP/SES), domain allowlist, super-admin console.

## Quick start (local dev)

```bash
git clone https://github.com/amrshawqy/agentsync.git
cd agentsync
pnpm install
docker compose -f docker/docker-compose.yml up -d
pnpm db:migrate
pnpm build
pnpm --filter @agentsync/server dev
# in another terminal:
pnpm --filter @agentsync/web dev
```

Then open [http://localhost:3001](http://localhost:3001), sign in, and copy the MCP URL from `/connect` into your AI agent.

For self-hosting in production, see **[docs/deploy/DEPLOY.md](./docs/deploy/DEPLOY.md)**.

## Why AgentSync

Most teams run multiple disconnected apps while their agents have fragmented context and inconsistent permissions. AgentSync centralizes:

- Data model and schema evolution
- Access control and tenant isolation
- Audit and provenance
- Multi-agent coordination via events
- Blueprint-based business system deployment

## Core Capabilities

- Multi-tenant team/workspace/table architecture
- Schema-first model with constraints, validation, and hints for agents
- Field-level provenance (`who`, `when`, `confidence`)
- Event system (SSE + webhooks + subscription management)
- Blueprint marketplace and one-command blueprint deployment
- Agent Kit generation for common agent platforms
- OAuth + JWT auth for API and MCP access
- Agent-native onboarding:
  - Agent key challenge registration
  - Team creation and invite acceptance
  - Optional email verification via OTP (Resend)

## Repository Structure

```text
agentsync/
├── packages/
│   ├── types/      # Shared zod schemas and TypeScript types
│   ├── db/         # Drizzle schema, migrations, seeders
│   ├── server/     # API + MCP server + business services
│   └── sdk/        # Typed JavaScript/TypeScript SDK
├── blueprints/     # Built-in blueprints (crm, hr, pm, support, ...)
├── docker/         # Local Postgres + Redis setup
├── docs/           # Vision, product spec, architecture docs
└── scripts/        # Helper scripts
```

## Tech Stack

- Runtime: Node.js 20+
- Language: TypeScript
- API: Hono
- MCP: `@modelcontextprotocol/sdk`
- Database: PostgreSQL 16 + Drizzle ORM
- Cache/Streams: Redis 7
- Validation: Zod
- Build: pnpm + Turborepo
- Tests: Vitest

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop

### 1) Install dependencies

```bash
pnpm install
```

### 2) Start infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 3) Run migrations and seed

```bash
pnpm db:migrate
pnpm db:seed
```

### 4) Build all packages

```bash
pnpm build
```

### 5) Start server

```bash
pnpm --filter @agentsync/server dev
```

Server defaults:

- REST API: `http://localhost:3000/v1`
- MCP endpoint: `http://localhost:3000/mcp`
- Health: `http://localhost:3000/health`

## Environment Variables

Use `.env.example` as baseline.

Important variables:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `PUBLIC_BASE_URL`
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`
- `RESEND_API_KEY` (optional in local)
- `EMAIL_FROM` (required if sending OTP emails)

Onboarding and limits:

- `UNVERIFIED_MAX_TEAMS`
- `UNVERIFIED_MAX_INVITES_PER_DAY`
- `VERIFIED_MAX_INVITES_PER_DAY`
- `EMAIL_OTP_EXPIRY_MINUTES`
- `EMAIL_OTP_MAX_ATTEMPTS`

## Agent-First Onboarding Flow

This is the intended SaaS-style flow:

1. Agent calls `POST /v1/auth/agent/challenge` with public JWK.
2. Agent signs challenge locally, then calls `POST /v1/auth/agent/register`.
3. Agent receives onboarding token.
4. Agent creates team with `POST /v1/teams` (creator becomes admin).
5. Admin agent invites members via `POST /v1/teams/:teamId/invites`.
6. Invited user/agent accepts with `POST /v1/teams/invites/accept`.
7. Optional: account email verification via OTP:
   - `POST /v1/auth/email/start`
   - `POST /v1/auth/email/verify`
8. Admin deploys blueprint (e.g. CRM) and starts operations.

## Step-by-Step Usage Guide (Non-Technical, OpenClaw)

Use this guide if you are an end-user with an AI agent (for example OpenClaw) and you want your agent to do all setup actions for you.

### 0) Check the service is running

Open:

- [http://localhost:3000/health](http://localhost:3000/health)

You should see an `ok` status.

### 1) Add AgentSync to OpenClaw

In OpenClaw MCP settings:

1. Add MCP server URL: [http://localhost:3000/mcp](http://localhost:3000/mcp)
2. Add API base URL: [http://localhost:3000](http://localhost:3000)

### 2) Let your agent create your account (agent-first)

Tell your agent:

- "Create my AgentSync account using agent-key registration."

Under the hood, the agent will:

1. Call `POST /v1/auth/agent/challenge`
2. Sign challenge with its key
3. Call `POST /v1/auth/agent/register`
4. Save returned access token

### 3) Confirm identity/profile

Tell your agent:

- "Check my AgentSync profile."

Agent calls:

- `GET /v1/auth/me`

Local link:

- [http://localhost:3000/v1/auth/me](http://localhost:3000/v1/auth/me) (token required)

### 4) Create your team (you become admin automatically)

Tell your agent:

- "Create a team named Acme Sales with slug acme-sales."

Agent calls:

- `POST /v1/teams`

This creates the team and makes your account team admin.

Local link:

- [http://localhost:3000/v1/teams](http://localhost:3000/v1/teams) (token required)

### 5) Invite team members

Tell your admin agent:

- "Invite user1@company.com and user2@company.com as members."

Agent calls:

- `POST /v1/teams/{teamId}/invites`

Agent receives invite codes/links to share.

### 6) Members join the team

Each invited person does:

1. Connect their own agent to AgentSync (same MCP URL).
2. Agent creates their account (same step 2).
3. Agent accepts invite:
   - `POST /v1/teams/invites/accept` with invite code.

### 7) Optional email verification (unlock higher limits)

Tell your agent:

1. "Start email verification for me@company.com"
2. After you receive OTP: "My OTP is 123456"

Agent calls:

- `POST /v1/auth/email/start`
- `POST /v1/auth/email/verify`

Local links:

- [http://localhost:3000/v1/auth/email/start](http://localhost:3000/v1/auth/email/start)
- [http://localhost:3000/v1/auth/email/verify](http://localhost:3000/v1/auth/email/verify)

### 8) Create CRM for your team

Tell your admin agent:

- "Deploy CRM for this team."

Agent calls:

- `POST /v1/blueprints/crm/deploy`

Then you can tell the agent:

- "List CRM tables."
- "Create contact John Smith, john@acme.com."
- "Create company Acme Inc."
- "Create deal for Acme in Lead stage."

### 9) Daily team operations

After setup, team agents can:

1. Create/query/update CRM records
2. Subscribe to events
3. Trigger automations
4. Operate within role-based permissions

### Quick local links

- Health: [http://localhost:3000/health](http://localhost:3000/health)
- MCP endpoint: [http://localhost:3000/mcp](http://localhost:3000/mcp)
- Teams: [http://localhost:3000/v1/teams](http://localhost:3000/v1/teams)
- Auth profile: [http://localhost:3000/v1/auth/me](http://localhost:3000/v1/auth/me)
- Blueprints: [http://localhost:3000/v1/blueprints](http://localhost:3000/v1/blueprints)

### Current UX gaps to be aware of

1. No end-user dashboard UI yet (current flow is agent/API-driven).
2. Invite links are generated, but no built-in `/invite/...` web page flow yet.
3. OTP delivery requires Resend configuration (`RESEND_API_KEY`, `EMAIL_FROM`).

## MCP Usage

Point your MCP client to:

```text
https://<your-host>/mcp
```

MCP provides tools for:

- Data CRUD and querying
- Schema and workspace operations
- Events and subscriptions
- Member/role administration
- Blueprint deployment and marketplace
- Audit/provenance queries
- Agent onboarding lifecycle

## Key REST Endpoints

Public / mixed onboarding:

- `GET /health`
- `POST /oauth/token`
- `POST /oauth/device/authorize`
- `POST /oauth/device/verify`
- `POST /v1/auth/agent/challenge`
- `POST /v1/auth/agent/register`
- `POST /v1/auth/token`
- `GET /v1/auth/me`
- `POST /v1/auth/email/start`
- `POST /v1/auth/email/verify`

JWT-protected application APIs:

- `/v1/records/*`
- `/v1/schema/*`
- `/v1/workspaces/*`
- `/v1/members/*`
- `/v1/teams/*`
- `/v1/blueprints/*`
- `/v1/events/*`
- `/v1/agent-kit/*`
- `/v1/automations/*`
- `/v1/audit/*`

## Development Commands

```bash
# Lint/test/build
pnpm test
pnpm build

# Per package
pnpm --filter @agentsync/server test
pnpm --filter @agentsync/server typecheck
pnpm --filter @agentsync/db migrate
pnpm --filter @agentsync/db seed
```

## Testing

- Unit and integration tests: Vitest
- MCP tool behavior tests included in `packages/server/test/mcp`
- Recommended pre-push check:

```bash
pnpm test && pnpm build
```

## Security and Isolation Notes

- Team-level tenant boundaries are enforced at API and DB layers
- Role permissions are applied per workspace/table/field/record
- JWT includes team/user/role context for authorization
- OTP flow is rate-limited and attempt-bound

## Deployment Notes

- Build server package and run `node packages/server/dist/index.js`
- Provide managed Postgres and Redis for production
- Set secure `JWT_SECRET` and proper `PUBLIC_BASE_URL`
- Configure Resend for email verification and invite delivery

## Documentation

- [Vision](./docs/01-vision.md)

- [Product Spec](./docs/03-product-spec.md)
- [Technical Architecture](./docs/04-technical-architecture.md)


### Self-host

- [Deploy](./docs/deploy/DEPLOY.md) — Docker Compose and Helm
- [Environment variables](./docs/deploy/ENV.md)
- [Backup & restore](./docs/deploy/BACKUP.md)
- [Upgrade](./docs/deploy/UPGRADE.md)
- [Security](./SECURITY.md)

## License

MIT
