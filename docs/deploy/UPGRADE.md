# Upgrade

AgentSync follows additive migrations. Major versions are documented in the release notes.

## Routine upgrades

1. Read the release notes for the target version. Check for breaking changes.
2. Take a Postgres backup (see `BACKUP.md`).
3. Pull the new image:
   ```bash
   docker compose -f docker/docker-compose.prod.yml pull
   docker compose -f docker/docker-compose.prod.yml up -d
   ```
   Helm:
   ```bash
   helm upgrade agentsync deploy/helm/agentsync -n agentsync \
     --set image.server.tag=<new-tag> --set image.web.tag=<new-tag> --reuse-values
   ```
4. Migrations run automatically on server startup (additive). Check `/health` after the upgrade.

## Version skew

The server supports running with an N-1 web image and vice versa for one minor version (so rolling upgrades work). Avoid running across two majors.

## JWT secret rotation

Manual procedure (v1):

1. Schedule a maintenance window.
2. Set the new `JWT_SECRET` and restart all server pods.
3. All existing sessions become invalid; users sign back in.

A grace-window ("verify with old or new for 24h") rotation is planned for v1.1.
