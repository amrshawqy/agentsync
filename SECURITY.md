# Security

## Reporting vulnerabilities

Please email security disclosures to the maintainer listed in `Chart.yaml` / repository metadata. Do not open public issues for unpatched vulnerabilities.

## Threat model summary

- **Authentication**: Server-issued JWTs (HS256, signed by `JWT_SECRET`); OIDC SSO via discovery; agent-key challenge/response for headless agents; OAuth 2.1 with PKCE for MCP clients.
- **Authorization**: 6-layer permission engine evaluates user → workspace → table → record → field. Admins are explicit; super-admin is a separate per-account flag and is never inferred from team membership.
- **Tenant isolation**: Postgres RLS keyed by `app.current_team_id`, set per request from the authenticated JWT.
- **Webhooks**: SSRF guarded by `WEBHOOK_*` allow/blocklists.
- **Email**: Pluggable provider; OTPs are hashed at rest and rate-limited per challenge.
- **Setup tokens**: One-time, 24-hour, hashed at rest; only mint-and-print when no super-admin exists and `BOOTSTRAP_ADMIN_EMAIL` is unset.

## Operational hygiene

- Rotate `JWT_SECRET` annually or on suspected compromise. See `docs/deploy/UPGRADE.md`.
- Keep `SIGNUP_ALLOWED_DOMAINS` set in any internet-exposed deployment unless you intend public sign-up.
- Review the audit log (`GET /v1/audit`) for unfamiliar agents and roles regularly.
- Disable unused agent keys via `accounts.agents` admin tools.
- Set `WEBHOOK_BLOCKED_HOSTS` and `WEBHOOK_BLOCKED_CIDRS` to your internal ranges.

## Defaults

- `JWT_SECRET` defaults to `change-me-in-production` and the server logs a warning if used in production.
- `EMAIL_PROVIDER` defaults to `console` so dev environments don't accidentally email real users.
- Agent registration is open by default to support self-service; tighten with `SIGNUP_ALLOWED_DOMAINS` and SSO.
