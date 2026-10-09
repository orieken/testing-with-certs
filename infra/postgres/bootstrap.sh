#!/bin/bash
set -euo pipefail

export PGPASSWORD
PGPASSWORD=$(cat /secrets/admin/postgres-password)
conn='host=postgres port=5432 dbname=postgres user=postgres sslmode=verify-full sslrootcert=/public/server-ca.pem connect_timeout=5'
psql -X -q -v ON_ERROR_STOP=1 "$conn" -c 'SELECT 1' >/dev/null

for name in keycloak customer catalog insights; do
  password=$(cat "/secrets/$name/postgres-password")
  [[ $password =~ ^[0-9a-f]{64}$ ]] || { echo 'Invalid generated password format' >&2; exit 1; }
  role="${name}_app"
  db="${name}_db"
  psql -X -q -v ON_ERROR_STOP=1 -v role="$role" -v db="$db" -v password="$password" "$conn" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', :'role', :'password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'role')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db', :'role') \gexec
SQL
done

psql -X -q -v ON_ERROR_STOP=1 "$conn" <<'SQL'
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL
echo 'Four database owners and scoped databases are ready over verified TLS.'
