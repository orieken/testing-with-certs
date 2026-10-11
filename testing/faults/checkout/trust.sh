#!/bin/sh
set -eu
store="$HOME/.local/share/pki/nssdb"
mkdir -p "$store"
if [ ! -f "$store/cert9.db" ]; then
  timeout 10s certutil -N --empty-password -d "sql:$store" </dev/null
fi
timeout 10s certutil -A -d "sql:$store" -n magic-shop-server -t 'C,,' -i /public/server-ca.pem </dev/null
export NSS_DEFAULT_DB_TYPE=sql
export NODE_EXTRA_CA_CERTS=/public/server-ca.pem
exec "$@"
