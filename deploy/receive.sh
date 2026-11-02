#!/usr/bin/env bash
# Executed over SSH; the shared server's configuration stays on the server.
set -euo pipefail
release_id="${1:?Pass a release ID}"
[[ "$release_id" =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]]
set -a
. "$HOME/.mapstothestars.env"
set +a
: "${STARS_APP_DIR:?Set STARS_APP_DIR}"
mkdir -p "$STARS_APP_DIR/releases"
exec 9> "$STARS_APP_DIR/deploy.lock"
flock -w 300 9
release="$STARS_APP_DIR/releases/$release_id"
test ! -e "$release"
mkdir "$release"
tar --no-same-owner -xzf "/tmp/mapstothestars-$release_id.tgz" -C "$release"
chmod -R a+rX "$release"
bash "$release/deploy/activate.sh"
