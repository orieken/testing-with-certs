#!/bin/sh
set -eu
umask 077
export DISPLAY=:99
Xvfb :99 -screen 0 1366x768x24 -nolisten tcp &
display_pid=$!
trap 'kill "$display_pid" ${wm_pid:-} ${vnc_pid:-} ${viewer_pid:-} 2>/dev/null || true' EXIT
node /work/testing/container/display-ready.mjs
fluxbox >/tmp/window-manager.log 2>&1 &
wm_pid=$!
node -e 'console.log(require("crypto").randomBytes(18).toString("base64url"))' > /tmp/viewer-password
x11vnc -storepasswd "$(cat /tmp/viewer-password)" /tmp/viewer-auth >/tmp/viewer-setup.log 2>&1
x11vnc -display :99 -rfbauth /tmp/viewer-auth -localhost -forever -shared -rfbport 5900 >/tmp/vnc.log 2>&1 &
vnc_pid=$!
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/viewer.log 2>&1 &
viewer_pid=$!
node /work/testing/rfc8705/viewer-ready.mjs
printf 'VNC desktop ready; viewer credentials stay in the private container.\n'
"$@"
