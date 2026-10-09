#!/bin/sh
set -eu
install -d -m 0700 -o postgres -g postgres /var/lib/postgresql/ssl
install -m 0600 -o postgres -g postgres /tls/key.pem /var/lib/postgresql/ssl/server.key
install -m 0644 -o postgres -g postgres /tls/cert.pem /var/lib/postgresql/ssl/server.crt
exec docker-entrypoint.sh postgres \
  -c ssl=on \
  -c ssl_cert_file=/var/lib/postgresql/ssl/server.crt \
  -c ssl_key_file=/var/lib/postgresql/ssl/server.key \
  -c hba_file=/etc/postgresql/pg_hba.conf \
  -c password_encryption=scram-sha-256 \
  -c statement_timeout=5000 \
  -c idle_in_transaction_session_timeout=10000
