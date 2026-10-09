#!/bin/sh
set -eu
export DEBIAN_FRONTEND=noninteractive
printf '%s\n' '54dea5f6c2a26091578cf52a999cebc6b64df478d37ad4dce96376b711e3b27c  /work/container/google.asc' '2fa9c05d591a1582a9aba276272478c262e95ad00acf60eaee1644d93941e3c6  /work/container/microsoft.asc' | sha256sum -c -
cp /work/container/*.asc /usr/share/keyrings/
node -e 'require("fs").writeFileSync("/tmp/bootstrap-ca.pem",require("tls").rootCertificates.join("\n"))'
printf '%s\n' 'deb [arch=amd64 signed-by=/usr/share/keyrings/google.asc] https://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/google.list
printf '%s\n' 'deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.asc] https://packages.microsoft.com/repos/edge stable main' > /etc/apt/sources.list.d/microsoft.list
apt-get -o Acquire::https::CaInfo=/tmp/bootstrap-ca.pem -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 update
# Every package in the resolver's dependency closure is pinned; unavailable versions fail closed.
xargs apt-get -o Acquire::https::CaInfo=/tmp/bootstrap-ca.pem -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 install -y --no-install-recommends < /work/container/apt.lock
rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/bootstrap-ca.pem
mkdir -p /etc/opt/chrome/policies/managed /etc/opt/edge/policies/managed /work/evidence
chown -R 1000:1000 /etc/opt/chrome /etc/opt/edge
# Runtime inventories are safe public evidence, never certificate material.
dpkg-query -W -f='${Package}=${Version}\n' > /work/evidence/installed-packages.txt
google-chrome --version > /work/evidence/browser-versions.txt
microsoft-edge --version >> /work/evidence/browser-versions.txt
