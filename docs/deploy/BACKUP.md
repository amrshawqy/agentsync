# Backup & restore

## Postgres

The authoritative store. Take regular logical backups:

```bash
pg_dump --format=custom --no-owner \
  --dbname="$DATABASE_URL" \
  --file="agentsync-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

For Helm with the bundled Postgres, exec in:

```bash
kubectl -n agentsync exec sts/agentsync-agentsync-postgres -- \
  pg_dump -U agentsync agentsync --format=custom --no-owner > backup.dump
```

Restore:

```bash
pg_restore --clean --no-owner --dbname="$DATABASE_URL" backup.dump
```

Recommended cadence: hourly snapshots if your underlying provider supports them, plus a daily logical dump archived to object storage (S3/R2/GCS) with at least 30-day retention.

## Redis

Redis holds caches, rate-limit counters, OAuth device codes, SSO state, and SSE connections. **It is not authoritative** — losing it forces users to re-authenticate any in-flight OAuth/SSO flows but does not lose data.

If you still want backups, configure Redis RDB snapshots (default in `redis:7-alpine`). Persistence path: `/data` (already a volume in compose and Helm).

## Object storage

If you enabled `S3_*` for uploads, follow your provider's lifecycle/versioning recommendations.

## Disaster recovery checklist

1. Restore Postgres from the latest dump.
2. Re-issue `JWT_SECRET` only if you suspect compromise; otherwise keep it to avoid invalidating active sessions.
3. Start the server with the same `PUBLIC_BASE_URL`. The bootstrap admin is preserved in the dump.
4. Verify `/health` and `GET /v1/explain` (as super-admin).
