#!/bin/bash
set -euo pipefail
KC_BOOTSTRAP_ADMIN_CLIENT_SECRET=$(cat /bootstrap-secret/client-secret)
export KC_BOOTSTRAP_ADMIN_CLIENT_SECRET
exec /opt/keycloak/bin/kc.sh start-dev --http-enabled=false --hostname=https://shop.magic.test:9643 \
  --https-certificate-file=/credentials/cert.pem --https-certificate-key-file=/credentials/key.pem \
  --health-enabled=true --http-management-scheme=http --http-management-host=127.0.0.1
