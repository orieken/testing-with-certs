#!/bin/bash
set -euo pipefail
umask 077
# New project only: no reuse of production PKI or host trust.
openssl req -x509 -newkey rsa:2048 -nodes -keyout /state/ca.key -out /trust/ca.pem -days 1 -subj /CN=Disposable-mock-CA >/dev/null 2>&1
for name in oidc api; do
  openssl req -newkey rsa:2048 -nodes -keyout /tls/$name.key -out /state/$name.csr -subj /CN=$name >/dev/null 2>&1
  printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\n' "$name" > /state/$name.ext
  openssl x509 -req -in /state/$name.csr -CA /trust/ca.pem -CAkey /state/ca.key -CAcreateserial -out /tls/$name.pem -days 1 -extfile /state/$name.ext >/dev/null 2>&1
done
openssl pkcs12 -export -out /tls/oidc.p12 -inkey /tls/oidc.key -in /tls/oidc.pem -passout pass: >/dev/null 2>&1
chmod 644 /trust/ca.pem
chown -R 1000:1000 /tls /state
