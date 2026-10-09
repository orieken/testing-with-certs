#!/bin/bash
set -euo pipefail
umask 077
exec 9>/out/admin/issuer.lock
flock -n 9 || { echo 'Another database secret operation is active' >&2; exit 1; }

for name in admin keycloak customer catalog insights; do
  path="/out/$name"
  if [[ ! -s $path/postgres-password ]]; then
    openssl rand -hex 32 > "$path/postgres-password"
  fi
  chown 999:999 "$path/postgres-password"
  chmod 0600 "$path/postgres-password"
  if [[ $name != admin ]]; then
    if [[ ! -s $path/service-password ]]; then
      cp "$path/postgres-password" "$path/service-password"
    fi
    chown 1000:1000 "$path/service-password"
    chmod 0600 "$path/service-password"
  fi
done
echo 'Database credentials ready in scoped volumes; existing values preserved.'
