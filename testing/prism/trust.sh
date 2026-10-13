#!/bin/sh
set -eu
mkdir -p "$HOME/.local/share/pki/nssdb"
if [ ! -f "$HOME/.local/share/pki/nssdb/cert9.db" ]; then
  timeout 10s certutil -N --empty-password -d "sql:$HOME/.local/share/pki/nssdb"
  timeout 10s certutil -A -d "sql:$HOME/.local/share/pki/nssdb" -n disposable-prism-server -t 'C,,' -i /public/server-ca.pem
fi
export NSS_DEFAULT_DB_TYPE=sql NODE_EXTRA_CA_CERTS=/public/server-ca.pem
exec "$@"
