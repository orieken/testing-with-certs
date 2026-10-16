#!/bin/sh
set -eu
umask 077
kinit -kt /keytabs/client/user.keytab -c FILE:/tickets/valid-cache -l 30m lesson-kerberos@MAGIC.TEST
kinit -kt /keytabs/client/user.keytab -c FILE:/tickets/expired-cache -l 1s lesson-kerberos@MAGIC.TEST
# Export only the wrong service ticket: no TGT can silently acquire the correct service ticket.
kvno -q -c FILE:/tickets/valid-cache -k /keytabs/client/wrong-service.keytab \
  --out-cache FILE:/tickets/wrong-service-cache HTTP/wrong.magic.test@MAGIC.TEST
kvno -q --cached-only -c FILE:/tickets/wrong-service-cache HTTP/wrong.magic.test@MAGIC.TEST
if klist -c FILE:/tickets/wrong-service-cache | grep -Eq 'krbtgt/|HTTP/auth\.magic\.test@'; then
  echo 'Wrong-service cache contains unexpected credentials' >&2; exit 1
fi
if kvno -q --cached-only -c FILE:/tickets/wrong-service-cache HTTP/auth.magic.test@MAGIC.TEST 2>/dev/null; then
  echo 'Wrong-service cache can satisfy the real endpoint' >&2; exit 1
fi
# Only the negative fixture expires; no browser or server clock is changed.
sleep 2
klist -s -c FILE:/tickets/valid-cache
if klist -s -c FILE:/tickets/expired-cache; then echo 'Expected expired fixture cache' >&2; exit 1; fi
echo 'Valid, expired, and verified wrong-service Kerberos ticket caches prepared in the private volume.'
