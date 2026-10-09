#!/bin/bash
set -euo pipefail
umask 077
exec 9>/out/admin/issuer.lock
flock -n 9 || { echo 'Another auth secret operation is active' >&2; exit 1; }
for name in admin catalog reporting; do
  path="/out/$name/client-secret"
  if [[ ! -s $path ]]; then openssl rand -hex 32 > "$path"; fi
  chmod 0600 "$path"
done
echo 'Scoped auth client credentials ready; existing values preserved.'
