#!/bin/bash
set -euo pipefail
bash /work/issue.sh
openssl verify -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /state/revocable.crt
bash /work/issue.sh revoke
if openssl verify -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /state/revocable.crt; then
  echo 'Revoked certificate unexpectedly accepted' >&2
  exit 1
fi
openssl verify -CAfile /public/user-ca.pem -CRLfile /public/user.crl.pem -crl_check /state/customer.crt
openssl verify -CAfile /public/server-ca.pem -verify_hostname shop.magic.test /state/shop.crt
