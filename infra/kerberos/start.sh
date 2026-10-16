#!/bin/sh
set -eu
umask 077
if [ ! -f /state/principal ]; then
  # Send the random database master password through stdin, never process arguments.
  node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("hex"))' > /state/master-password
  { cat /state/master-password; printf '\n'; cat /state/master-password; printf '\n'; } | kdb5_util create -s -r MAGIC.TEST
  rm /state/master-password
fi
if ! kadmin.local -q 'getprinc HTTP/auth.magic.test@MAGIC.TEST' 2>/dev/null | grep -q '^Principal:'; then
  kadmin.local -q 'addprinc -randkey HTTP/auth.magic.test@MAGIC.TEST' >/dev/null
fi
if ! kadmin.local -q 'getprinc lesson-kerberos@MAGIC.TEST' 2>/dev/null | grep -q '^Principal:'; then
  kadmin.local -q 'addprinc -randkey lesson-kerberos@MAGIC.TEST' >/dev/null
fi
if ! kadmin.local -q 'getprinc HTTP/wrong.magic.test@MAGIC.TEST' 2>/dev/null | grep -q '^Principal:'; then
  kadmin.local -q 'addprinc -randkey HTTP/wrong.magic.test@MAGIC.TEST' >/dev/null
fi
if [ ! -s /keytabs/client/wrong-service.keytab ]; then
  kadmin.local -q 'ktadd -norandkey -k /keytabs/client/wrong-service.keytab HTTP/wrong.magic.test@MAGIC.TEST' >/dev/null
fi
if [ ! -s /keytabs/server/http.keytab ]; then
  kadmin.local -q 'ktadd -norandkey -k /keytabs/server/http.keytab HTTP/auth.magic.test@MAGIC.TEST' >/dev/null
fi
if [ ! -s /keytabs/client/user.keytab ]; then
  kadmin.local -q 'ktadd -norandkey -k /keytabs/client/user.keytab lesson-kerberos@MAGIC.TEST' >/dev/null
fi
test -s /keytabs/server/http.keytab
test -s /keytabs/client/user.keytab
exec krb5kdc -n -r MAGIC.TEST -P /state/kdc.pid
