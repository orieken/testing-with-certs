#!/bin/sh
set -eu
umask 077
case "${LAB_AUTH_LESSON:-index}" in
  index) route=/teaching;;
  password-otp|passkeys|oidc|saml|kerberos) route="/teaching/$LAB_AUTH_LESSON";;
  *) echo 'Unknown manual authentication lesson' >&2; exit 2;;
esac
export DISPLAY=:99 KRB5_CONFIG=/etc/krb5.conf KRB5CCNAME=FILE:/tickets/valid-cache
Xvfb :99 -screen 0 1366x768x24 -nolisten tcp &
node /work/testing/container/display-ready.mjs
"${LAB_WINDOW_MANAGER:-fluxbox}" >/tmp/window-manager.log 2>&1 &
node -e 'console.log(require("crypto").randomBytes(6).toString("base64url"))' > /tmp/viewer-password
x11vnc -storepasswd "$(cat /tmp/viewer-password)" /tmp/viewer-auth >/tmp/viewer-setup.log 2>&1
x11vnc -display :99 -rfbauth /tmp/viewer-auth -localhost -forever -shared -rfbport 5900 >/tmp/vnc.log 2>&1 &
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/viewer.log 2>&1 &
case "$LAB_BROWSER" in chrome) browser=google-chrome;; msedge) browser=microsoft-edge;; *) exit 2;; esac
node /work/testing/teaching/prepare-kerberos.mjs "$HOME/profile" "$LAB_BROWSER"
exec "$browser" --no-sandbox --no-first-run --user-data-dir="$HOME/profile" \
  --auth-server-allowlist=auth.magic.test --auth-schemes=negotiate --disable-auth-negotiate-cname-lookup \
  "https://shop.magic.test:8543$route"
