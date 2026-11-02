#!/usr/bin/env bash
# Run on the server after uploading dist/ and deploy/ as a release directory.
#
# Required environment (see deploy/README.md):
#   STARS_APP_DIR         base directory holding releases/, backups/ and current
#   STARS_HOSTNAME        public hostname served by the shared HTTPS proxy
#   STARS_PROXY_CADDYFILE host path of the shared proxy's Caddyfile
#   STARS_PROXY_CONTAINER name of the running shared Caddy proxy container
#   STARS_PROXY_NETWORK   Docker network shared with the proxy (used by compose.yaml)
set -euo pipefail

: "${STARS_APP_DIR:?Set STARS_APP_DIR}"
: "${STARS_HOSTNAME:?Set STARS_HOSTNAME}"
: "${STARS_PROXY_CADDYFILE:?Set STARS_PROXY_CADDYFILE}"
: "${STARS_PROXY_CONTAINER:?Set STARS_PROXY_CONTAINER}"
: "${STARS_PROXY_NETWORK:?Set STARS_PROXY_NETWORK}"
export STARS_PROXY_NETWORK

release="$(cd "$(dirname "$0")/.." && pwd)"
app="$STARS_APP_DIR"
proxy="$STARS_PROXY_CADDYFILE"
container="$STARS_PROXY_CONTAINER"

case "$release" in
  "$app"/releases/*) ;;
  *) echo "Upload this release under $app/releases/ first." >&2; exit 1 ;;
esac
test -f "$release/dist/index.html"
test -L "$app/current" || test ! -e "$app/current"

cd "$release/deploy"
sudo --preserve-env=STARS_PROXY_NETWORK docker compose config --quiet
sudo --preserve-env=STARS_PROXY_NETWORK docker compose run --rm --no-deps web caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo --preserve-env=STARS_PROXY_NETWORK docker compose up -d --no-build --pull never --wait --wait-timeout 90

backup="$app/backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup"
cp "$proxy" "$backup/Caddyfile"
if test -L "$app/current"; then readlink "$app/current" > "$backup/previous-release"; fi
sudo docker ps --format '{{.Names}} {{.ID}}' > "$backup/containers-before.txt"

python3 - "$proxy" "$release/deploy/edge.Caddyfile" "$backup/Caddyfile.candidate" "$STARS_HOSTNAME" <<'PY'
from pathlib import Path
import sys

source, fragment, candidate = map(Path, sys.argv[1:4])
hostname = sys.argv[4]
original = source.read_text()
addition = "\n".join(
    line for line in fragment.read_text().replace("{$STARS_HOSTNAME}", hostname).splitlines()
    if not line.lstrip().startswith("#")
).strip()
if hostname in original and addition not in original:
    raise SystemExit("Existing hostname configuration differs; review before changing it.")
candidate.write_text(original if addition in original else original.rstrip() + "\n\n" + addition + "\n")
PY

sudo docker cp "$backup/Caddyfile.candidate" "$container:/tmp/mapstothestars.Caddyfile"
sudo docker exec "$container" caddy validate --config /tmp/mapstothestars.Caddyfile --adapter caddyfile
cmp -s "$proxy" "$backup/Caddyfile" || { echo 'Proxy changed during validation; retry after review.' >&2; exit 1; }

# Preserve the host inode. Reload the staged copy because older deployments may
# already have replaced the host inode behind the proxy's read-only file mount.
# The host copy supplies the same configuration when Docker remounts on restart.
cat "$backup/Caddyfile.candidate" > "$proxy"
if ! sudo docker exec "$container" caddy reload --config /tmp/mapstothestars.Caddyfile --adapter caddyfile; then
  cat "$backup/Caddyfile" > "$proxy"
  sudo docker cp "$backup/Caddyfile" "$container:/tmp/mapstothestars.Caddyfile"
  sudo docker exec "$container" caddy reload --config /tmp/mapstothestars.Caddyfile --adapter caddyfile
  exit 1
fi
ln -sfn "$release" "$app/current"
printf 'Active release: %s\nProxy backup: %s\n' "$release" "$backup"
