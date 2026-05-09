# AgentSync skill

> A self-contained instruction set for AI agents (OpenClaw, Claude Desktop, Cursor, Cline, Continue, custom MCP clients, and any LLM with tool use). If you are an agent and a human pointed you at this file, read it once and follow it as your canonical guide for everything you can do with AgentSync.

This file is shipped at the repo root and also served live by every AgentSync deployment at:

```
<your-agentsync-base-url>/skill.md
```

So an operator can tell their team: "point your agent at `https://agentsync.acme.com/skill.md`" and any compliant agent can pick it up.

---

## 1. What AgentSync is

AgentSync is a self-hosted, multi-tenant data layer that AI agents share. One server holds many teams; each team has workspaces, tables, fields, records, members, roles, blueprints, events, automations. Agents talk to it via:

- **MCP** at `<base>/mcp` — preferred. OAuth 2.1 + PKCE + dynamic client registration. Standard browser sign-in on first use.
- **REST** at `<base>/v1/*` — same capabilities, JWT bearer auth.

Both are first-class. MCP is what end users see ("paste this URL into your agent"); REST is what scripts and the SDK use.

A single AgentSync URL is enough for any agent to do anything its role allows. There is no per-agent install page.

---

## 2. The three roles you might be playing

When a human gives you a task, identify which of these you are and skip to the matching section.

| Role | When | Sections to read |
|---|---|---|
| **Member agent** | A user told you "here is our AgentSync URL, work with our data". Default case. | §3 connect → §6 daily ops |
| **Admin agent** | The user owns the team or just signed up. They want to set up data, invite people, deploy blueprints. | §3 connect → §5 admin setup → §6 daily ops |
| **Installer agent** | You are helping IT install AgentSync on a server. Rare. | §4 self-host → §5 admin setup |

If unsure, ask the user one short question: "Are you setting up AgentSync for your team for the first time, or joining an existing team?"

---

## 3. Connecting to AgentSync (every agent does this once)

You need exactly one piece of information from the user: the **base URL**, e.g. `https://agentsync.acme.com` (or `http://localhost:3000` in local dev). The MCP endpoint is always `<base>/mcp`.

### 3.1 If you are an MCP client (OpenClaw, Claude Desktop, Cursor, Cline, Continue, etc.)

Add the URL `<base>/mcp` as a custom MCP server in the agent's settings. On first tool call, the agent's MCP client will:

1. Receive `401 WWW-Authenticate: Bearer realm="agentsync", resource_metadata="<base>/.well-known/oauth-protected-resource"` from `/mcp`.
2. Fetch `<base>/.well-known/oauth-protected-resource` and `<base>/.well-known/oauth-authorization-server` to discover the auth server.
3. Dynamically register a client at `POST <base>/oauth/register` (PKCE-only public client).
4. Open a browser to `<base>/oauth/authorize?...` for the user to approve.
5. Exchange the code at `<base>/oauth/token` and store the token.

You do not implement any of this yourself. A compliant MCP client handles it. Your only job: tell the user "your browser will open for sign-in, then we're done."

### 3.2 If you are a custom REST/SDK agent

Use the agent-key flow:

```
POST /v1/auth/agent/challenge   { jwk }                    → { challenge }
# sign challenge with your Ed25519 private key, base64url-encode
POST /v1/auth/agent/register    { jwk, signature }         → { token, account, agent }
```

Save the token. Send it as `Authorization: Bearer <token>` on every request.

To switch teams later: `POST /v1/teams/:teamId/switch` returns a team-scoped token; use that one.

### 3.3 Confirm you are connected

Call `get_my_profile` (MCP) or `GET /v1/auth/me` (REST). You should see your account, current team, and role.

If the user pointed you at a brand-new deployment with no teams yet, jump to §5.

---

## 4. Self-hosting AgentSync (installer agent only)

Only relevant if you are helping IT deploy AgentSync. Skip if a base URL was already given to you.

### 4.1 Prerequisites

- Docker and Docker Compose, or a Kubernetes cluster.
- A domain pointed at the host, with TLS (Caddy in the prod compose handles this for you).
- Optional: an OIDC provider (Google / Microsoft Entra / Okta / Authentik) for SSO, and an email provider (Resend / SMTP / SES) for invites and OTPs.

### 4.2 Docker Compose (simplest path)

```bash
git clone https://github.com/amrshawqy/agentsync.git
cd agentsync
cp .env.example .env
# edit .env — at minimum set JWT_SECRET, PUBLIC_BASE_URL, DATABASE_URL, REDIS_URL,
# BOOTSTRAP_ADMIN_EMAIL (the email of the human who will be super-admin),
# and EMAIL_PROVIDER (console for dev; resend|smtp|ses for prod)
docker compose -f docker/docker-compose.prod.yml up -d
```

Caddy fronts the server (port 3000) and the web app (port 3001) on one domain. Postgres and Redis run as named-volume services.

### 4.3 Helm (Kubernetes)

```bash
helm install agentsync deploy/helm/agentsync \
  --set ingress.host=agentsync.acme.com \
  --set env.PUBLIC_BASE_URL=https://agentsync.acme.com \
  --set env.BOOTSTRAP_ADMIN_EMAIL=admin@acme.com \
  --set secrets.JWT_SECRET=$(openssl rand -hex 32)
```

See `deploy/helm/agentsync/values.yaml` for everything you can override (image tags, ingress, resources, persistence, OIDC, email provider).

### 4.4 First-run super-admin

Two paths, in order of preference:

1. **`BOOTSTRAP_ADMIN_EMAIL`** set in env. The first account that registers with this email is auto-promoted to platform super-admin.
2. **One-time setup token.** If `BOOTSTRAP_ADMIN_EMAIL` is unset, the server prints a one-time token to stdout on first start (24h TTL, single use). The user submits it at `<base>/setup` to elevate their account.

After bootstrap, the super-admin signs in to `<base>/admin` for the operator console (health, usage, audit, teams).

### 4.5 Important env vars

| Var | Purpose |
|---|---|
| `PUBLIC_BASE_URL` | Public URL the server is reachable at. Must match what users put in their agents. |
| `JWT_SECRET` | 32+ bytes random. Rotate with care. |
| `DATABASE_URL` | Postgres 16 connection string. |
| `REDIS_URL` | Redis 7 connection string. |
| `EMAIL_PROVIDER` | `console`, `resend`, `smtp`, or `ses`. |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Optional SSO. Empty = email/OTP only. |
| `SIGNUP_ALLOWED_DOMAINS` | Comma-separated. Empty = open registration. |
| `BOOTSTRAP_ADMIN_EMAIL` | Email auto-promoted to super-admin on first registration. |
| `ANTHROPIC_API_KEY` | Optional. Enables "describe what you track" blueprint drafting. |

Full list: `docs/deploy/ENV.md`.

---

## 5. First-time admin setup

The user just signed in (or just got a new team). Walk them through this in conversation; do not do destructive steps without confirming each one.

### 5.1 Create or pick a team

If the account has no teams: `create_team({ name, slug })`. The creator becomes team admin automatically.

If the account has multiple teams and the user did not specify: `list_my_teams`, then ask which.

### 5.2 (Optional) verify email to unlock higher limits

`start_email_verification({ email })` sends an OTP. Ask the user for the code. `verify_email_otp({ email, code })`. Verified accounts get higher invite/team caps.

### 5.3 Decide on a data model

Two paths. Ask the user which they prefer:

**Path A — built-in blueprint (fastest).** Call `list_blueprints` and present the catalog (CRM, HR, PM, support, finance, inventory, …). Once chosen: `deploy_blueprint({ slug, workspaceName? })`. Tables, fields, relations, default roles all get created.

**Path B — describe in plain English (best when nothing fits).** Ask the user "in 1–3 sentences, what does your business track?" Then call `POST /v1/blueprints/draft-from-description { description }`. Show the user the proposed tables/fields tree. Let them edit names. Then deploy.

If both fail to fit, fall back to manual: `create_workspace`, `create_table`, `alter_table` to add fields one at a time. Use this sparingly — blueprints are usually faster.

### 5.4 Invite teammates

For each person: `invite_member({ email, roleId })`. The server generates an invite link (`<base>/invite/<code>`) and emails it if the email provider is configured. The invitee opens the link, signs in (or registers via their own agent), and lands inside the team.

Default roles created by every blueprint: `admin`, `member`, `viewer`. Use `list_members` and `create_role` for custom permissions.

### 5.5 Confirm setup

Call `explain_team`. You get a plain-English summary: team name, blueprint, table/field counts, recent activity, the user's role and what they can do. Read this back to the user.

---

## 6. Daily operations

This is what most agents do most of the time. Same MCP tools across all roles; permissions decide what succeeds.

### 6.1 Discover the schema

```
list_workspaces                  → workspaces in this team
list_tables({ workspaceId })      → tables in a workspace
describe_table({ tableId })       → fields, types, constraints, hints, transitions
describe_schema                   → everything at once (use sparingly; large)
search_global({ query })          → search across all tables
```

Each field has: `type` (text/email/url/phone/number/currency/date/datetime/boolean/select/multi_select/relation/json/...), `required`, `validation`, `options` (for selects), `transitions` (for state-machine selects), `agent_hint` (free-text guidance for you), `field_order`.

### 6.2 Records: create, read, update, delete

```
create_record({ tableId, data, provenance? })
get_record({ id })
query_records({ tableId, filter?, sort?, limit?, cursor? })
update_record({ id, data, provenance? })
delete_record({ id })           # soft-delete; 7-day retention
```

When you write data, set `provenance` to `{ source: "agent", agentId: <your id>, confidence: 0..1 }` so the user can see where data came from.

### 6.3 Relations and traversal

```
link_records({ fromId, toId, relationName })
unlink_records({ fromId, toId, relationName })
traverse({ fromId, path: ["company", "deals", "contacts"], depth? })
```

### 6.4 Verify a field (raise confidence)

```
verify_field({ recordId, fieldName, source })
```

### 6.5 Bulk import

```
bulk_import({ tableId, rows, dedupeBy?, provenance? })
```

For >100 rows, split into batches of 100. The server returns per-row results.

### 6.6 Undo and provenance

Every record write is snapshotted into `record_revisions` (7-day retention). When you make a mistake or the user says "undo":

```
GET /v1/records/:id/revisions               → list revisions newest first
POST /v1/records/:id/revert  { to_revision_id }
get_provenance({ recordId })                 → who wrote each field, when, with what confidence
```

When the user asks "where did this come from?" or "who set this?", call `get_provenance`.

### 6.7 Events and subscriptions

If the user wants to be notified or wants you to react to changes by other agents:

```
subscribe_events({ tableId?, eventTypes?, filter? })   → returns a subscription with SSE URL or webhook
list_subscriptions
unsubscribe_events({ id })
```

For one-shot streaming inside your agent runtime: connect to `GET /v1/events/stream`.

### 6.8 Automations (trigger → action)

```
create_automation({ name, trigger, action })   # e.g. on record.created in deals → POST webhook
list_automations
toggle_automation({ id, enabled })
```

### 6.9 Suggestions (when you'd like a schema or data change you cannot make yourself)

If your role can't add a field but you'd benefit from one:

```
suggest_field({ tableId, name, type, rationale, agent_hint })
```

The team admin sees it in `/app/suggestions` and approves or rejects. You can also propose record-level changes (`record_create`, `record_update`, `record_delete`) for human review when you are not confident.

When the user is an admin and you see pending suggestions:

```
list_suggestions                        → list pending
approve_suggestion({ id, note? })
reject_suggestion({ id, note? })
```

---

## 7. MCP tool reference (full list)

| Domain | Tools |
|---|---|
| **Auth** | `register_agent_identity`, `get_my_profile`, `list_my_teams`, `create_team`, `switch_team`, `start_email_verification`, `verify_email_otp` |
| **Schema** | `describe_table`, `describe_schema`, `list_workspaces`, `list_tables`, `create_workspace`, `create_table`, `alter_table`, `search_global` |
| **Data** | `create_record`, `get_record`, `query_records`, `update_record`, `delete_record`, `link_records`, `unlink_records`, `traverse`, `verify_field`, `bulk_import` |
| **Members** | `list_members`, `add_member`, `update_member_role`, `create_role`, `set_field_access`, `invite_member`, `accept_team_invite` |
| **Blueprints** | `list_blueprints`, `deploy_blueprint`, `create_blueprint`, `evolve_blueprint`, `publish_blueprint` |
| **Events** | `subscribe_events`, `unsubscribe_events`, `list_subscriptions` |
| **Automations** | `create_automation`, `list_automations`, `toggle_automation` |
| **Suggestions** | `suggest_field`, `list_suggestions`, `approve_suggestion`, `reject_suggestion` |
| **Utility** | `get_agent_kit`, `query_audit_log`, `get_agent_activity`, `get_provenance`, `search_marketplace`, `submit_blueprint_review`, `get_context`, `explain_team` |

Tool input/output schemas are sent over MCP itself — call `tools/list` to see them at runtime. They are the source of truth.

---

## 8. REST endpoint reference (equivalents)

For non-MCP agents and scripts. Every protected route requires `Authorization: Bearer <token>`.

```
# health and discovery
GET    /health
GET    /.well-known/oauth-protected-resource
GET    /.well-known/oauth-authorization-server

# OAuth (handled by your MCP client; included for completeness)
POST   /oauth/register
GET    /oauth/authorize
POST   /oauth/token
POST   /oauth/revoke
POST   /oauth/device/authorize
POST   /oauth/device/verify

# auth and onboarding
POST   /v1/auth/agent/challenge
POST   /v1/auth/agent/register
POST   /v1/auth/token
GET    /v1/auth/me
POST   /v1/auth/email/start
POST   /v1/auth/email/verify
GET    /v1/auth/sso/start
GET    /v1/auth/sso/callback

# data
GET    /v1/records?table=<tableId>&...
POST   /v1/records
GET    /v1/records/:id
PATCH  /v1/records/:id
DELETE /v1/records/:id
GET    /v1/records/:id/revisions
POST   /v1/records/:id/revert
GET    /v1/records/:id/provenance

# schema
GET    /v1/schema
POST   /v1/schema/workspaces
POST   /v1/schema/tables
PATCH  /v1/schema/tables/:id
POST   /v1/schema/fields
PATCH  /v1/schema/fields/:id
POST   /v1/schema/fields/reorder

# teams and members
POST   /v1/teams
GET    /v1/teams
POST   /v1/teams/:teamId/switch
POST   /v1/teams/:teamId/invites
POST   /v1/teams/invites/accept
GET    /v1/members
PATCH  /v1/members/:id

# blueprints
GET    /v1/blueprints
POST   /v1/blueprints/:slug/deploy
POST   /v1/blueprints/draft-from-description

# events
GET    /v1/events/stream         # SSE
POST   /v1/events/subscribe
DELETE /v1/events/subscriptions/:id

# automations, suggestions, audit, marketplace, agent-kit, explain
POST   /v1/automations
GET    /v1/suggestions
POST   /v1/suggestions/:id/approve
POST   /v1/suggestions/:id/reject
GET    /v1/audit
GET    /v1/marketplace/search
GET    /v1/agent-kit/download
GET    /v1/explain

# admin (super-admin only)
GET    /v1/admin/diagnostics
GET    /v1/admin/metrics
GET    /v1/admin/teams
```

---

## 9. Schema model in one minute

```
Account ──┬── User (membership in a Team, with a Role)
          └── User …

Team ──── Workspace ──── Table ──── Field
                                 │
                                 └── Record ─── (typed values + per-field provenance)

Blueprint = packaged set of (Workspace, Table, Field, Role) definitions
Automation = trigger (event) + action (webhook / tool call)
Suggestion = proposed change held for admin approval
```

- A team is the tenant boundary. RLS on Postgres enforces it; you cannot read another team's data even with raw SQL.
- A workspace groups related tables (e.g. "sales", "support"). One team can have many.
- Tables have fields; fields have types, constraints, and **agent hints** — short instructions written for you, the agent. Read them.
- Selects with `transitions` are state machines. The server rejects invalid transitions; respect them.

---

## 10. Permission model in one minute

Six layers, evaluated in order, deny wins:

1. Team membership (you must be a member to do anything).
2. Role permissions (`read`, `write`, `delete`, `admin` per workspace/table).
3. Field-level access (a role can be locked out of specific fields).
4. Record-level rules (e.g. only assignee can update).
5. Tenant isolation via Postgres RLS.
6. Rate limits per token.

If a call returns `403 FORBIDDEN`, you cannot do it under your current role. Don't retry; either ask the admin to grant access, or `suggest_field` / propose a record change.

---

## 11. Common workflows (natural language → tool calls)

User says... | You do...
---|---
"Set up our sales pipeline." | `list_blueprints` → present CRM → `deploy_blueprint({ slug: "crm" })` → `explain_team`.
"We run a small clinic with patients and appointments." | `POST /v1/blueprints/draft-from-description { description }` → preview → confirm → deploy.
"Add Sarah to the team as a member." | `invite_member({ email: "sarah@…", roleId: <member> })` → return invite link.
"Show me all open deals over $10k." | `describe_table({ slug: "deals" })` to find field names → `query_records({ tableId, filter: { stage: { in: openStages }, value: { gt: 10000 } }, sort: "-value" })`.
"Add a phone number to John Smith." | `query_records({ tableId: contacts, filter: { name: "John Smith" } })` → `update_record({ id, data: { phone: "…" }, provenance: { agentId, confidence: 0.95 } })`.
"Undo my last change to that contact." | `GET /v1/records/:id/revisions` → take the second-most-recent → `POST /v1/records/:id/revert { to_revision_id }`.
"Where did this email come from?" | `get_provenance({ recordId })` → read out source/agent/timestamp/confidence.
"Notify me when a deal moves to closed-won." | `create_automation({ trigger: { event: "record.updated", table: "deals", filter: { stage: "closed-won" } }, action: { type: "webhook", url } })`.
"I need a 'priority' field on tasks but I'm not admin." | `suggest_field({ tableId, name: "priority", type: "select", options: ["low","med","high"], rationale })`.
"What does this team track?" | `explain_team`.

When the user is vague, ask one concrete question; do not guess destructive specifics.

---

## 12. When to ask the user before acting

Always confirm:

- Deleting a record (`delete_record`) — say what you'll delete first.
- Schema changes outside of an approved blueprint (`alter_table`, `create_table`).
- Inviting members (`invite_member`) — confirm email and role.
- Approving or rejecting suggestions.
- Bulk imports >100 rows.
- Anything that will send email (invites).

Never destructive without consent. The user can override with "yes, do it" — once per scope, not standing.

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Bearer` on `/mcp` | No token / expired token | MCP client should refresh automatically. If not, ask user to sign in again. |
| `401 invalid_token` | Token signed with old `JWT_SECRET` | Re-auth. |
| `403 FORBIDDEN` | Role lacks the permission | See §10. Don't retry. |
| `409 INVALID_TRANSITION` | Tried to set a select to a value not allowed from current state | Check `describe_table` for the field's `transitions`. |
| `422 VALIDATION_ERROR` | Field value violates `validation` regex or `required` | Read the field constraints; correct the value. |
| `429 RATE_LIMITED` | Hit per-token rate limit | Back off; retry after `Retry-After` seconds. |
| OTP email never arrives | `EMAIL_PROVIDER=console` (dev) or wrong provider config | Tell user to check server logs (dev) or have IT set `EMAIL_PROVIDER`. |
| Browser opens but never returns | OAuth redirect URI mismatch | Tell user to check that `PUBLIC_BASE_URL` in server env matches the URL they opened. |
| `OIDC_DISCOVERY_FAILED` | Bad `OIDC_ISSUER` | Operator-side. |

Errors come back as `{ error: { code, message, hint? } }`. Show `message` and `hint` to the user verbatim.

---

## 14. Useful URLs to give a human user

If a human asks "where do I go?" rather than "what should the agent do?":

- `<base>/connect` — copy the MCP URL to paste into their agent.
- `<base>/sign-in` — SSO or magic-link sign-in.
- `<base>/app` — table view, schema, members, blueprints, suggestions.
- `<base>/admin` — operator console (super-admin only).
- `<base>/skill.md` — this file. Point other agents here.

---

## 15. Where to find more

- README in this repo — quickstart.
- `docs/deploy/DEPLOY.md` — full operator guide.
- `docs/deploy/ENV.md` — every env var.
- `CHANGELOG.md` — what changed between releases.
- MCP `tools/list` — authoritative tool schemas at runtime.

---

## 16. One-line summary for an LLM system prompt

> You have access to AgentSync, a shared self-hosted data layer for AI agents. Connect via the MCP URL the user gave you. Discover tools with `tools/list`. Follow `<base>/skill.md` for what to do. Confirm before any destructive action. Always set provenance when you write.
