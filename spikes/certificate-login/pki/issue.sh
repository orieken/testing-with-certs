#!/bin/bash
set -euo pipefail
umask 077
exec 9>/state/issuer.lock
flock -n 9 || { echo 'Another issuer operation is active' >&2; exit 1; }
create_authority() {
  local name=$1
  mkdir -p "/state/$name/newcerts"
  if [ -f "/state/$name/ca.crt" ]; then return; fi
  touch "/state/$name/index"
  echo 1000 > "/state/$name/serial"
  echo 1000 > "/state/$name/crlnumber"
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=Spike $name CA" -keyout "/state/$name/ca.key" -out "/state/$name/ca.crt" 2>/dev/null
  cat > "/state/$name/ca.cnf" <<CONFIG
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
default_days=7
default_crl_days=7
policy=identity
unique_subject=no
[identity]
commonName=supplied
CONFIG
}
issue_leaf() {
  local authority=$1 name=$2 subject=$3 usage=$4
  if [ -f "/state/$name.crt" ]; then return; fi
  openssl req -new -newkey rsa:2048 -nodes -subj "/CN=$subject" -keyout "/state/$name.key" -out "/state/$name.csr" 2>/dev/null
  printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=%s\n' "$usage" > /state/leaf.cnf
  if [ "$usage" = serverAuth ]; then printf 'subjectAltName=DNS:%s\n' "$subject" >> /state/leaf.cnf; fi
  openssl ca -batch -notext -config "/state/$authority/ca.cnf" -extfile /state/leaf.cnf -in "/state/$name.csr" -out "/state/$name.crt" 2>/dev/null
}
copy_pair() {
  cp "/state/$1.crt" "$2/cert.pem"
  cp "/state/$1.key" "$2/key.pem"
}
publish_crls() {
  for authority in user service; do
    openssl ca -gencrl -config "/state/$authority/ca.cnf" -out "/public/$authority.crl.pem" 2>/dev/null
  done
  chmod 644 /public/*
}
if [ "${1:-init}" = revoke ]; then
  openssl ca -config /state/user/ca.cnf -revoke /state/revocable.crt 2>/dev/null
  publish_crls
  exit
fi
for authority in user service server rogue; do create_authority "$authority"; done
issue_leaf server shop shop.magic.test serverAuth
issue_leaf server auth auth.magic.test serverAuth
issue_leaf server landing landing serverAuth
issue_leaf service gateway gateway clientAuth
issue_leaf user customer 11111111-1111-4111-8111-111111111111 clientAuth
issue_leaf user admin 22222222-2222-4222-8222-222222222222 clientAuth
issue_leaf user unknown 33333333-3333-4333-8333-333333333333 clientAuth
issue_leaf user revocable 44444444-4444-4444-8444-444444444444 clientAuth
issue_leaf rogue untrusted 11111111-1111-4111-8111-111111111111 clientAuth
issue_leaf service collision 11111111-1111-4111-8111-111111111111 clientAuth
copy_pair shop /gateway
cat /state/shop.key >> /gateway/cert.pem
cat /state/gateway.crt /state/gateway.key > /gateway/client.pem
copy_pair auth /keycloak
copy_pair landing /landing
for authority in user service server; do cp "/state/$authority/ca.crt" "/public/$authority-ca.pem"; done
mkdir -p /fixtures/clients
for name in customer admin unknown revocable untrusted collision; do
  cp "/state/$name.crt" "/fixtures/clients/$name.crt.pem"
  cp "/state/$name.key" "/fixtures/clients/$name.key.pem"
done
for name in customer admin; do
  copy_pair "$name" "/manual-$name"
  if [ ! -f "/manual-$name/password" ]; then openssl rand -hex 24 > "/manual-$name/password"; fi
  openssl pkcs12 -export -in "/state/$name.crt" -inkey "/state/$name.key" -out "/manual-$name/identity.p12" -passout "file:/manual-$name/password"
done
publish_crls
printf 'CA state and isolated leaves ready; no private material exported to host.\n'
