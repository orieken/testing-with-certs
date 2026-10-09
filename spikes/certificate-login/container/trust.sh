#!/bin/sh
set -eu
mkdir -p "$HOME/.local/share/pki/nssdb"
certutil -N --empty-password -d "sql:$HOME/.local/share/pki/nssdb"
certutil -A -d "sql:$HOME/.local/share/pki/nssdb" -n spike-server -t 'C,,' -i /public/server-ca.pem
# Set NSS_DEFAULT_DB_TYPE explicitly. Do not create a competing legacy database.
export NSS_DEFAULT_DB_TYPE=sql
exec "$@"
