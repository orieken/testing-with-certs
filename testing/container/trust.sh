#!/bin/sh
set -eu
mkdir -p "$HOME/.local/share/pki/nssdb"
certutil -N --empty-password -d "sql:$HOME/.local/share/pki/nssdb"
certutil -A -d "sql:$HOME/.local/share/pki/nssdb" -n magic-shop-server -t 'C,,' -i /public/server-ca.pem
export NSS_DEFAULT_DB_TYPE=sql
export NODE_EXTRA_CA_CERTS=/public/server-ca.pem
exec "$@"
