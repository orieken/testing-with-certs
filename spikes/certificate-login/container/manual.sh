#!/bin/sh
set -eu
umask 077
sh /work/container/native-identity.sh
export DISPLAY=:99
Xvfb :99 -screen 0 1366x768x24 -nolisten tcp &
# xdpyinfo is polled via Playwright expect.poll in the readiness helper.
node --import tsx /work/tests/display-ready.ts
fluxbox >/tmp/fluxbox.log 2>&1 &
openssl rand -hex 4 > /tmp/viewer-password
{ cat /tmp/viewer-password; cat /tmp/viewer-password; printf 'y\n'; } | x11vnc -storepasswd /tmp/viewer-auth >/tmp/viewer-setup.log 2>&1
x11vnc -display :99 -rfbauth /tmp/viewer-auth -localhost -forever -shared -rfbport 5900 >/tmp/vnc.log 2>&1 &
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/viewer.log 2>&1 &
case "$LAB_BROWSER" in chrome) browser=google-chrome;; msedge) browser=microsoft-edge;; *) exit 2;; esac
exec "$browser" --no-sandbox --no-first-run --user-data-dir="$HOME/profile" https://shop.magic.test:8443
