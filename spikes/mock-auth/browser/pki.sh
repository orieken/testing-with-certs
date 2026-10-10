#!/bin/bash
set -euo pipefail
umask 077
for type in server client; do
  openssl req -x509 -newkey rsa:2048 -nodes -keyout /state/$type-ca.key -out /public/$type-ca.pem -days 1 -subj /CN=Disposable-browser-$type-CA >/dev/null 2>&1
done
openssl req -newkey rsa:2048 -nodes -keyout /server/key.pem -out /state/server.csr -subj /CN=shop.magic.test >/dev/null 2>&1
printf 'subjectAltName=DNS:shop.magic.test,DNS:auth.magic.test,DNS:browser-ui\nextendedKeyUsage=serverAuth\n' > /state/server.ext
openssl x509 -req -in /state/server.csr -CA /public/server-ca.pem -CAkey /state/server-ca.key -CAcreateserial -out /server/cert.pem -days 1 -extfile /state/server.ext >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout /identity/key.pem -out /state/client.csr -subj /CN=synthetic-customer >/dev/null 2>&1
printf 'extendedKeyUsage=clientAuth\n' > /state/client.ext
openssl x509 -req -in /state/client.csr -CA /public/client-ca.pem -CAkey /state/client-ca.key -CAcreateserial -out /identity/cert.pem -days 1 -extfile /state/client.ext >/dev/null 2>&1
chmod 644 /public/*.pem
chown -R 1000:1000 /server /identity
