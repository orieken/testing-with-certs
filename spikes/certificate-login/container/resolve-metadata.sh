#!/bin/sh
set -eu
node /scripts/resolve-metadata.mjs
# Debian packages are authenticated by signed Release metadata even over HTTP.
# Browser repository HTTPS additionally requires a CA bundle, supplied below.
node -e 'require("fs").writeFileSync("/tmp/ca.pem",require("tls").rootCertificates.join("\n"))'
opts='-o Dir::Etc::sourcelist=/tmp/sources.list -o Dir::Etc::sourceparts=- -o Acquire::https::CaInfo=/tmp/ca.pem -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30'
apt-get $opts update
apt-get $opts --simulate install --no-install-recommends google-chrome-stable microsoft-edge-stable libnss3-tools openssl xvfb xauth x11-utils x11vnc novnc websockify fluxbox > /output/apt-plan.txt
apt-cache $opts policy google-chrome-stable microsoft-edge-stable > /output/browser-candidates.txt
cp /tmp/google.asc /tmp/microsoft.asc /output/
