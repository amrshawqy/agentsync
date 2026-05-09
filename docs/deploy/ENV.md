# Environment variables

Required, optional, and per-feature variables. Set via `.env`, container env, or Helm `values.env`.

## Core (always required in prod)

| Var | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection | e.g. `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection | e.g. `redis://host:6379` |
| `JWT_SECRET` | Server-issued JWT signing key | rotate per `docs/deploy/UPGRADE.md` |
| `PUBLIC_BASE_URL` | Externally reachable URL of the API | used in OAuth metadata, invite links |

## Web app

| Var | Purpose | Notes |
|---|---|---|
| `WEB_BASE_URL` | URL of the web UI | defaults to `PUBLIC_BASE_URL` |

## Bootstrap & access control

| Var | Purpose |
|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | First user matching this email becomes super-admin |
| `SIGNUP_ALLOWED_DOMAINS` | Comma-separated list of allowed sign-up email domains; empty = open |

If `BOOTSTRAP_ADMIN_EMAIL` is unset and no super-admin exists, the server logs a one-time setup token at startup. Redeem it with `POST /v1/auth/setup/redeem` after signing in.

## Email delivery

| Var | Purpose |
|---|---|
| `EMAIL_PROVIDER` | One of `console` (dev), `resend`, `smtp`, `ses` (default `console`) |
| `EMAIL_FROM` | Sender address; required for any non-console provider |

Provider-specific:

- `RESEND_API_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`
- `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`

## SSO (OIDC)

| Var | Purpose |
|---|---|
| `OIDC_ISSUER` | OIDC discovery URL (e.g. `https://accounts.google.com`) |
| `OIDC_CLIENT_ID` | OIDC client ID |
| `OIDC_CLIENT_SECRET` | OIDC client secret (omit for public clients) |
| `OIDC_SCOPES` | Default `openid email profile` |
| `OIDC_REDIRECT_PATH` | Default `/v1/auth/sso/callback` |

## Optional

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the "describe what you track" wizard |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Object storage for uploads |
| `LOG_LEVEL` | `debug`/`info`/`warn`/`error` (default `debug` in dev, `info` in prod) |

See `.env.example` for a template.
