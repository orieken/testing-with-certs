#!/bin/sh
set -eu
umask 077
sh /work/testing/container/native-identity.sh
export DISPLAY=:99
Xvfb :99 -screen 0 1366x768x24 -nolisten tcp &
node /work/testing/container/display-ready.mjs
exec node /work/testing/container/native-login.mjs
