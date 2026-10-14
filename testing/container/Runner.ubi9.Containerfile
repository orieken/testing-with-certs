FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS dependencies
WORKDIR /work
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --global pnpm@12.9.1 --fetch-timeout=30000 --fetch-retries=1
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/magic-shop/package.json apps/magic-shop/package.json
COPY packages/saturday-keycloak/package.json packages/saturday-keycloak/package.json
COPY services/customer-api/package.json services/customer-api/package.json
COPY testing/package.json testing/package.json
COPY contracts/package.json contracts/package.json
COPY spikes/certificate-login/vendor/orieken-saturday-playwright-certs-0.1.0.tgz spikes/certificate-login/vendor/orieken-saturday-playwright-certs-0.1.0.tgz
RUN pnpm install --frozen-lockfile --fetch-timeout=30000


FROM registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc
WORKDIR /work
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 HOME=/home/runner LAB_WINDOW_MANAGER=openbox PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY testing/container/google.asc testing/container/microsoft.asc /tmp/keys/
# Stream supplies desktop libraries absent from the redistributable UBI repositories.
# Keep signature verification enabled for both Stream and EPEL packages.
RUN rpm --import /tmp/keys/*.asc \
    && curl --fail --location --max-time 60 https://www.centos.org/keys/RPM-GPG-KEY-CentOS-Official -o /etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-Official \
    && printf '%s\n' '[stream-baseos]' 'name=Stream 9 BaseOS' 'baseurl=https://mirror.stream.centos.org/9-stream/BaseOS/x86_64/os/' 'gpgcheck=1' 'gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-Official' '[stream-appstream]' 'name=Stream 9 AppStream' 'baseurl=https://mirror.stream.centos.org/9-stream/AppStream/x86_64/os/' 'gpgcheck=1' 'gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-Official' '[stream-crb]' 'name=Stream 9 CRB' 'baseurl=https://mirror.stream.centos.org/9-stream/CRB/x86_64/os/' 'gpgcheck=1' 'gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-Official' > /etc/yum.repos.d/stream.repo \
    && curl --fail --location --max-time 60 https://dl.fedoraproject.org/pub/epel/RPM-GPG-KEY-EPEL-9 -o /etc/pki/rpm-gpg/RPM-GPG-KEY-EPEL-9 \
    && rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-EPEL-9 \
    && dnf --setopt=localpkg_gpgcheck=1 install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && printf '%s\n' '[google-chrome]' 'name=Chrome' 'baseurl=https://dl.google.com/linux/chrome/rpm/stable/x86_64' 'gpgcheck=1' 'gpgkey=file:///tmp/keys/google.asc' '[microsoft-edge]' 'name=Edge' 'baseurl=https://packages.microsoft.com/yumrepos/edge' 'gpgcheck=1' 'gpgkey=file:///tmp/keys/microsoft.asc' > /etc/yum.repos.d/browsers.repo \
    && dnf install -y google-chrome-stable microsoft-edge-stable nss-tools openssl procps-ng xorg-x11-server-Xvfb openbox x11vnc novnc python3-websockify liberation-fonts dbus-libs alsa-lib mesa-libgbm \
    && dnf clean all \
    && mkdir -p /etc/opt/chrome/policies/managed /etc/opt/edge/policies/managed /work/evidence \
    && chown -R 1000:1000 /etc/opt/chrome /etc/opt/edge \
    && rpm -qa | sort > /work/evidence/installed-packages.txt \
    && google-chrome --version > /work/evidence/browser-versions.txt \
    && microsoft-edge --version >> /work/evidence/browser-versions.txt
# The shared display health probe uses xdpyinfo.
RUN dnf install -y xorg-x11-utils && dnf clean all && rpm -qa | sort > /work/evidence/installed-packages.txt
COPY testing/container/ testing/container/
COPY --from=dependencies /work/node_modules /work/node_modules
COPY --from=dependencies /work/testing/node_modules /work/testing/node_modules
COPY --from=dependencies /work/services/customer-api/node_modules /work/services/customer-api/node_modules
COPY --from=dependencies /work/packages/saturday-keycloak/node_modules /work/packages/saturday-keycloak/node_modules
RUN /work/testing/node_modules/.bin/playwright install ffmpeg && chmod -R a+rX /opt/ms-playwright
COPY packages/saturday-keycloak/ /work/packages/saturday-keycloak/
RUN cd /work/packages/saturday-keycloak && /work/packages/saturday-keycloak/node_modules/.bin/tsc -p tsconfig.json
COPY testing/ testing/
RUN cd /work/testing && /work/testing/node_modules/.bin/tsc -p tsconfig.runtime.json
COPY contracts/ contracts/
COPY seed/identities.json seed/identities.json
RUN mkdir -p /home/runner /work/testing/test-results /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix && chown -R 1000:1000 /home/runner /work/testing/test-results
USER 1000:1000
ENTRYPOINT ["sh", "/work/testing/container/trust.sh"]
CMD ["node", "/work/testing/container/smoke.mjs"]
