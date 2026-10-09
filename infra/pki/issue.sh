#!/bin/bash
set -euo pipefail
umask 077
exec 9>/state/issuer.lock
flock -n 9 || { echo 'Another issuer operation is active' >&2; exit 1; }

declare -A identity=(
  [customer-waterdeep]=11111111-1111-4111-8111-111111111111
  [customer-baldur]=33333333-3333-4333-8333-333333333333
  [customer-neverwinter]=77777777-7777-4777-8777-777777777777
  [shopkeeper]=55555555-5555-4555-8555-555555555555
  [shop-admin]=22222222-2222-4222-8222-222222222222
  [disabled-customer]=66666666-6666-4666-8666-666666666666
  [unknown-user]=88888888-8888-4888-8888-888888888888
)
declare -A service_identity=(
  [gateway-client]=gateway
  [customer-client]=customer-api
  [catalog-client]=catalog-api
  [insights-client]=insights-api
)

authority() {
  local name=$1
  mkdir -p "/state/$name/newcerts"
  if [[ -f /state/$name/ca.crt ]]; then return; fi
  touch "/state/$name/index"
  printf '1000\n' > "/state/$name/serial"
  printf '1000\n' > "/state/$name/crlnumber"
  cat > "/state/$name/root.cnf" <<EOF
[req]
distinguished_name=dn
x509_extensions=root
prompt=no
[dn]
CN=Magic Shop $name CA
[root]
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
EOF
  openssl req -x509 -newkey rsa:3072 -nodes -days 3650 \
    -config "/state/$name/root.cnf" \
    -keyout "/state/$name/ca.key" -out "/state/$name/ca.crt" >/dev/null 2>&1
  cat > "/state/$name/ca.cnf" <<EOF
[ca]
default_ca=issuer
[issuer]
dir=/state/$name
database=\$dir/index
new_certs_dir=\$dir/newcerts
certificate=\$dir/ca.crt
private_key=\$dir/ca.key
serial=\$dir/serial
crlnumber=\$dir/crlnumber
default_md=sha256
default_days=30
default_crl_days=7
policy=identity
unique_subject=no
[identity]
commonName=supplied
EOF
}

publish_pair() {
  local name=$1
  cp "/state/leaves/$name.crt" "/out/$name/cert.pem"
  cp "/state/leaves/$name.key" "/out/$name/key.pem"
  chmod 0644 "/out/$name/cert.pem"
  chmod 0600 "/out/$name/key.pem"
  if [[ -n ${identity[$name]:-} ]]; then
    if [[ ! -s /out/$name/password ]]; then
      openssl rand -hex 24 > "/out/$name/password"
    fi
    openssl pkcs12 -export -in "/out/$name/cert.pem" -inkey "/out/$name/key.pem" \
      -out "/out/$name/identity.p12.tmp" -passout "file:/out/$name/password" >/dev/null 2>&1
    mv "/out/$name/identity.p12.tmp" "/out/$name/identity.p12"
    chmod 0600 "/out/$name/password" "/out/$name/identity.p12"
  fi
}

issue() {
  local ca=$1 name=$2 subject=$3 usage=$4
  if [[ -f /state/leaves/$name.crt ]]; then publish_pair "$name"; return; fi
  openssl req -new -newkey rsa:2048 -nodes -subj "/CN=$subject" \
    -keyout "/state/leaves/$name.key" -out "/state/leaves/$name.csr" >/dev/null 2>&1
  cat > "/state/leaves/$name.ext" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=$usage
EOF
  if [[ $usage == serverAuth ]]; then printf 'subjectAltName=DNS:%s\n' "$subject" >> "/state/leaves/$name.ext"; fi
  openssl ca -batch -notext -config "/state/$ca/ca.cnf" \
    -extfile "/state/leaves/$name.ext" -in "/state/leaves/$name.csr" \
    -out "/state/leaves/$name.crt" >/dev/null 2>&1
  publish_pair "$name"
}

publish_crl() {
  local ca=$1
  openssl ca -gencrl -config "/state/$ca/ca.cnf" -out "/public/$ca.crl.pem.tmp" >/dev/null 2>&1
  chmod 0644 "/public/$ca.crl.pem.tmp"
  mv "/public/$ca.crl.pem.tmp" "/public/$ca.crl.pem"
  if [[ $ca == service ]]; then
    cat /public/service-ca.pem /public/service.crl.pem > /public/service-trust-crl.pem.tmp
    chmod 0644 /public/service-trust-crl.pem.tmp
    mv /public/service-trust-crl.pem.tmp /public/service-trust-crl.pem
  fi
}

case "${1:-init}" in
  init)
    mkdir -p /state/leaves
    for ca in server user service; do
      authority "$ca"
      cp "/state/$ca/ca.crt" "/public/$ca-ca.pem"
      chmod 0644 "/public/$ca-ca.pem"
    done
    for name in shop auth ui customer-api catalog-api insights-api postgres; do
      case "$name" in shop|auth) subject="$name.magic.test";; *) subject="$name";; esac
      issue server "$name" "$subject" serverAuth
    done
    for name in "${!service_identity[@]}"; do
      issue service "$name" "${service_identity[$name]}" clientAuth
    done
    for name in "${!identity[@]}"; do
      issue user "$name" "${identity[$name]}" clientAuth
    done
    # HAProxy consumes the certificate and private key in one PEM file.
    cat /out/shop/cert.pem /out/shop/key.pem > /out/shop/combined.pem
    cat /out/gateway-client/cert.pem /out/gateway-client/key.pem > /out/gateway-client/combined.pem
    chmod 0600 /out/shop/combined.pem /out/gateway-client/combined.pem
    for ca in server user service; do publish_crl "$ca"; done
    echo 'PKI initialized; existing leaves and serial state preserved.'
    ;;
  renew)
    name=${2:-}
    [[ -n ${identity[$name]:-} ]] || { echo 'Unsupported user identity' >&2; exit 2; }
    [[ -f /state/leaves/$name.crt ]] || { echo 'Initialize PKI first' >&2; exit 2; }
    [[ ! -e /state/leaves/$name.previous.crt ]] || { echo 'Retire the previous serial before another renewal' >&2; exit 2; }
    mv "/state/leaves/$name.crt" "/state/leaves/$name.previous.crt"
    mv "/state/leaves/$name.key" "/state/leaves/$name.previous.key"
    rm -f "/state/leaves/$name.csr"
    issue user "$name" "${identity[$name]}" clientAuth
    echo "Renewed $name; previous serial remains valid until revoked or expired."
    ;;
  revoke)
    name=${2:-}
    [[ -n ${identity[$name]:-} ]] || { echo 'Unsupported user identity' >&2; exit 2; }
    [[ -z ${3:-} || ${3:-} == previous ]] || { echo 'Only current or previous serial is supported' >&2; exit 2; }
    cert="/state/leaves/$name${3:+.$3}.crt"
    [[ -f $cert ]] || { echo 'Certificate not found' >&2; exit 2; }
    if ! openssl ca -config /state/user/ca.cnf -revoke "$cert" >/dev/null 2>&1; then
      echo 'Certificate already revoked or issuer operation failed' >&2; exit 2
    fi
    publish_crl user
    echo "Revoked $name ${3:-current}; reload TLS consumers before new-connection checks."
    ;;
  retire)
    name=${2:-}
    [[ -n ${identity[$name]:-} ]] || { echo 'Unsupported user identity' >&2; exit 2; }
    [[ -f /state/leaves/$name.previous.crt ]] || { echo 'No previous certificate' >&2; exit 2; }
    result=$(openssl verify -purpose sslclient -CAfile /public/user-ca.pem \
      -CRLfile /public/user.crl.pem -crl_check "/state/leaves/$name.previous.crt" 2>&1) && {
        echo 'Previous certificate is still valid; revoke it first' >&2; exit 2;
      }
    [[ $result == *'certificate revoked'* ]] || {
      echo 'Previous certificate did not fail for revocation; refusing retirement' >&2; exit 2;
    }
    rm -f "/state/leaves/$name.previous.crt" "/state/leaves/$name.previous.key"
    echo "Retired $name previous leaf; issuer index and CRL retain its revoked serial."
    ;;
  migrate-service)
    name=${2:-}
    [[ -n ${service_identity[$name]:-} ]] || { echo 'Unsupported service identity' >&2; exit 2; }
    cert="/state/leaves/$name.crt"
    [[ -f $cert ]] || { echo 'Initialize PKI first' >&2; exit 2; }
    subject=$(openssl x509 -in "$cert" -noout -subject -nameopt RFC2253)
    if [[ $subject == "subject=CN=${service_identity[$name]}" ]]; then
      echo "Service identity $name is already correct."
      exit 0
    fi
    [[ ! -e /state/leaves/$name.previous.crt ]] || { echo 'A previous service leaf already exists' >&2; exit 2; }
    openssl ca -config /state/service/ca.cnf -revoke "$cert" >/dev/null 2>&1
    mv "$cert" "/state/leaves/$name.previous.crt"
    rm -f "/state/leaves/$name.key" "/state/leaves/$name.csr"
    issue service "$name" "${service_identity[$name]}" clientAuth
    publish_crl service
    echo "Migrated $name to ${service_identity[$name]}; previous serial revoked."
    ;;
  revoke-service)
    name=${2:-}
    [[ -n ${service_identity[$name]:-} ]] || { echo 'Unsupported service identity' >&2; exit 2; }
    cert="/state/leaves/$name.crt"
    [[ -f $cert ]] || { echo 'Initialize PKI first' >&2; exit 2; }
    openssl ca -config /state/service/ca.cnf -revoke "$cert" >/dev/null 2>&1 || {
      echo 'Certificate already revoked or issuer operation failed' >&2; exit 2;
    }
    publish_crl service
    echo "Revoked service client $name; restart service TLS consumers before fresh-connection checks."
    ;;
  negative-service|negative-user)
    [[ ${LAB_NEGATIVE_FIXTURE:-} == yes ]] || { echo 'Negative fixtures require explicit isolated-test flag' >&2; exit 2; }
    mode=${1#negative-}
    kind=${2:-}
    case "$kind" in expired|future) ;; *) echo 'Expected expired or future' >&2; exit 2;; esac
    [[ -s /state/$mode/ca.crt && -d /out/negative ]] || { echo 'Initialized isolated issuer and negative output volume required' >&2; exit 2; }
    name="negative-$mode-$kind"
    if [[ $mode == service ]]; then subject=customer-api; else subject=${identity[customer-waterdeep]}; fi
    if [[ ! -f /state/leaves/$name.crt ]]; then
      openssl req -new -newkey rsa:2048 -nodes -subj "/CN=$subject" \
        -keyout "/state/leaves/$name.key" -out "/state/leaves/$name.csr" >/dev/null 2>&1
      cat > "/state/leaves/$name.ext" <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth
EOF
      if [[ $kind == expired ]]; then
        start=$(date -u -d '4 days ago' +%Y%m%d%H%M%SZ)
        end=$(date -u -d '2 days ago' +%Y%m%d%H%M%SZ)
      else
        start=$(date -u -d '2 days' +%Y%m%d%H%M%SZ)
        end=$(date -u -d '4 days' +%Y%m%d%H%M%SZ)
      fi
      openssl ca -batch -notext -config "/state/$mode/ca.cnf" -startdate "$start" -enddate "$end" \
        -extfile "/state/leaves/$name.ext" -in "/state/leaves/$name.csr" \
        -out "/state/leaves/$name.crt" >/dev/null 2>&1
    fi
    cp "/state/leaves/$name.crt" /out/negative/cert.pem
    cp "/state/leaves/$name.key" /out/negative/key.pem
    chmod 0644 /out/negative/cert.pem
    chmod 0600 /out/negative/key.pem
    echo "Issued isolated $kind $mode validity fixture."
    ;;
  verify)
    openssl verify -purpose sslserver -verify_hostname shop.magic.test -CAfile /public/server-ca.pem /out/shop/cert.pem
    openssl verify -purpose sslserver -verify_hostname auth.magic.test -CAfile /public/server-ca.pem /out/auth/cert.pem
    openssl verify -purpose sslserver -verify_hostname postgres -CAfile /public/server-ca.pem /out/postgres/cert.pem
    openssl verify -purpose sslclient -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /out/customer-waterdeep/cert.pem
    if openssl verify -purpose sslclient -CAfile /public/service-ca.pem /out/customer-waterdeep/cert.pem >/dev/null 2>&1; then
      echo 'Human certificate accepted by service CA' >&2; exit 1
    fi
    if openssl verify -purpose sslserver -verify_hostname wrong.magic.test -CAfile /public/server-ca.pem /out/shop/cert.pem >/dev/null 2>&1; then
      echo 'Wrong server hostname accepted' >&2; exit 1
    fi
    test -s /public/user.crl.pem && test -s /public/service.crl.pem && test -s /public/server.crl.pem
    echo 'Chain, EKU, hostname, trust-domain negatives and initial CRLs verified.'
    ;;
  *) echo 'Usage: issue.sh init|verify|renew <seed-user>|revoke <seed-user> [previous]|retire <seed-user>|migrate-service <service-client>|revoke-service <service-client>' >&2; exit 2;;
esac
