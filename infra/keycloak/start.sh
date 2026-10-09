#!/bin/bash
set -euo pipefail
KC_DB_PASSWORD=$(cat /secrets/service-password)
export KC_DB_PASSWORD
KC_BOOTSTRAP_ADMIN_CLIENT_SECRET=$(cat /bootstrap-secret/client-secret)
export KC_BOOTSTRAP_ADMIN_CLIENT_SECRET
exec /opt/keycloak/bin/kc.sh start --optimized
