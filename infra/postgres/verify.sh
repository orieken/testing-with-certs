#!/bin/bash
set -euo pipefail

base='host=postgres port=5432 sslmode=verify-full sslrootcert=/public/server-ca.pem connect_timeout=5'
for name in keycloak customer catalog insights; do
  export PGPASSWORD
  PGPASSWORD=$(cat "/secrets/$name/postgres-password")
  role="${name}_app"
  db="${name}_db"
  result=$(psql -X -A -t -v ON_ERROR_STOP=1 "$base user=$role dbname=$db" \
    -c "SELECT current_user || ',' || current_database() || ',' || ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()")
  [[ $result == "$role,$db,true" ]] || { echo "Incorrect role, database or TLS state for $name" >&2; exit 1; }
  other=customer_db
  [[ $name == customer ]] && other=catalog_db
  if psql -X -q "$base user=$role dbname=$other" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "Cross-database CONNECT unexpectedly allowed for $name" >&2; exit 1
  fi
done

export PGPASSWORD
PGPASSWORD=$(cat /secrets/customer/postgres-password)
if psql -X -q 'host=postgres port=5432 user=customer_app dbname=customer_db sslmode=disable connect_timeout=5' \
  -c 'SELECT 1' >/dev/null 2>&1; then
  echo 'Plaintext PostgreSQL connection accepted' >&2; exit 1
fi
if psql -X -q 'host=postgres port=5432 user=customer_app dbname=customer_db sslmode=verify-full sslrootcert=/public/service-ca.pem connect_timeout=5' \
  -c 'SELECT 1' >/dev/null 2>&1; then
  echo 'Wrong PostgreSQL server CA accepted' >&2; exit 1
fi
hostaddr=$(getent ahostsv4 postgres | awk 'NR==1 {print $1}')
[[ -n $hostaddr ]] || { echo 'PostgreSQL address unavailable' >&2; exit 1; }
if psql -X -q "host=wrong.magic.test hostaddr=$hostaddr port=5432 user=customer_app dbname=customer_db sslmode=verify-full sslrootcert=/public/server-ca.pem connect_timeout=5" \
  -c 'SELECT 1' >/dev/null 2>&1; then
  echo 'Wrong PostgreSQL hostname accepted' >&2; exit 1
fi
echo 'Four verified-TLS owners passed; cross-DB, plaintext, wrong CA and wrong hostname rejected.'
