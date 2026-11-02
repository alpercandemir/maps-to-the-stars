#!/usr/bin/env bash
# Called by CI after all checks pass; credentials exist only for this job.
set -euo pipefail
: "${STARS_DEPLOY_HOST:?Set STARS_DEPLOY_HOST}"
: "${STARS_DEPLOY_USER:?Set STARS_DEPLOY_USER}"
: "${STARS_KNOWN_HOSTS:?Set STARS_KNOWN_HOSTS}"
: "${STARS_PUBLIC_URL:?Set STARS_PUBLIC_URL}"
: "${STARS_SSH_KEY:?Set STARS_SSH_KEY}"
: "${STARS_RELEASE_ID:?Set STARS_RELEASE_ID}"
[[ "$STARS_RELEASE_ID" =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]]
[[ "$STARS_DEPLOY_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]
[[ "$STARS_DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
archive="${1:?Pass the release archive}"
credentials="$(mktemp -d)"
trap 'rm -rf "$credentials"' EXIT
chmod 700 "$credentials"
printf '%s\n' "$STARS_SSH_KEY" > "$credentials/key"
printf '%s\n' "$STARS_KNOWN_HOSTS" > "$credentials/known_hosts"
chmod 600 "$credentials/key" "$credentials/known_hosts"
unset STARS_SSH_KEY
options=(-i "$credentials/key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$credentials/known_hosts" -o ConnectTimeout=15)
target="$STARS_DEPLOY_USER@$STARS_DEPLOY_HOST"
scp "${options[@]}" "$archive" "$target:/tmp/mapstothestars-$STARS_RELEASE_ID.tgz"
ssh "${options[@]}" "$target" "bash -s -- '$STARS_RELEASE_ID'" < "$(dirname "$0")/receive.sh"
curl --fail --silent --show-error --retry 5 --retry-delay 3 --max-time 20 "$STARS_PUBLIC_URL/healthz"
