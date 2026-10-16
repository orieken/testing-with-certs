#!/bin/sh
set -eu
umask 077
kinit -kt /keytabs/client/user.keytab -c FILE:/tickets/valid-cache -l 30m lesson-kerberos@MAGIC.TEST
kinit -kt /keytabs/client/user.keytab -c FILE:/tickets/expired-cache -l 1s lesson-kerberos@MAGIC.TEST
# Only the negative fixture expires; no browser or server clock is changed.
sleep 2
klist -s -c FILE:/tickets/valid-cache
if klist -s -c FILE:/tickets/expired-cache; then echo 'Expected expired fixture cache' >&2; exit 1; fi
echo 'Valid and expired Kerberos ticket caches prepared in the private volume.'
