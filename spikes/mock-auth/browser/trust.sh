#!/bin/sh
set -eu
mkdir -p "$HOME/.local/share/pki/nssdb"
if [ ! -f "$HOME/.local/share/pki/nssdb/cert9.db" ]; then
  certutil -N --empty-password -d "sql:$HOME/.local/share/pki/nssdb"
  certutil -A -d "sql:$HOME/.local/share/pki/nssdb" -n disposable-browser-server -t 'C,,' -i /public/server-ca.pem
  certutil -A -d "sql:$HOME/.local/share/pki/nssdb" -n disposable-oidc-server -t 'C,,' -i /oidc-trust/ca.pem
fi
cat /public/server-ca.pem /oidc-trust/ca.pem > /tmp/mock-ca-bundle.pem
export NSS_DEFAULT_DB_TYPE=sql NODE_EXTRA_CA_CERTS=/tmp/mock-ca-bundle.pem
exec "$@"
