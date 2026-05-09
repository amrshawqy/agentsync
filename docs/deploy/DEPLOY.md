# Deploy AgentSync

Two paths: Docker Compose (single-host) or Helm (Kubernetes).

## Path 1 — Docker Compose

1. Copy `.env.example` to `.env` next to `docker/docker-compose.prod.yml`. Fill in `JWT_SECRET`, `PUBLIC_BASE_URL`, `DOMAIN`, and at minimum:
   - `BOOTSTRAP_ADMIN_EMAIL=you@yourdomain.com` (so you can sign in as super-admin)
   - `SIGNUP_ALLOWED_DOMAINS=yourdomain.com` (optional but recommended)
   - Email provider variables (start with `EMAIL_PROVIDER=console` to test, then swap to `smtp`/`resend`/`ses`)
   - OIDC variables if you want SSO from day one

2. Build and start:
   ```bash
   cd docker
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. Run the database migration:
   ```bash
   docker compose -f docker-compose.prod.yml exec server node -e "import('@agentsync/db').then(m => m.runMigrations())" \
     # or use the migrate script
   ```
   *Or* run `pnpm --filter @agentsync/db migrate` against the same `DATABASE_URL` from your local machine before starting `server`.

4. Visit `https://<DOMAIN>`. Caddy auto-issues TLS; the web UI is on `/`, OAuth and MCP are on the same origin.

5. Sign in with `BOOTSTRAP_ADMIN_EMAIL` via SSO (or email/OTP). You should land in `/setup`.

## Path 2 — Helm

```bash
cd deploy/helm/agentsync
helm install agentsync . \
  --namespace agentsync --create-namespace \
  --set publicBaseUrl=https://agentsync.example.com \
  --set ingress.host=agentsync.example.com \
  --set-string secrets.jwtSecret="$(openssl rand -hex 32)" \
  --set env.BOOTSTRAP_ADMIN_EMAIL=you@yourdomain.com \
  --set env.SIGNUP_ALLOWED_DOMAINS=yourdomain.com \
  --set env.EMAIL_PROVIDER=smtp \
  --set-string env.SMTP_HOST=smtp.example.com \
  --set-string env.SMTP_USER=postmaster \
  --set-string env.SMTP_PASSWORD="$SMTP_PASSWORD" \
  --set-string env.EMAIL_FROM="AgentSync <noreply@yourdomain.com>"
```

For production, disable the in-cluster Postgres/Redis and supply managed instances via `secrets.databaseUrl` and `secrets.redisUrl`.

## First-run setup

If `BOOTSTRAP_ADMIN_EMAIL` is set, the matching user automatically becomes super-admin on first sign-in.

If it is not set, watch server logs at startup for a `setup token` line. Sign in (any user), then `POST /v1/auth/setup/redeem` with `{ "token": "..." }` to elevate.

## Connecting an AI agent

End users connect by pasting `https://<DOMAIN>/mcp` into their AI agent's MCP/tools settings. The agent will trigger the standard OAuth flow on first use; no per-agent configuration is needed.
