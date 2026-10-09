FROM haproxy:3.2.6@sha256:7a5f2b4eac999e35d38b0c49040ec885ac2929c6b1a17fde0d1dc2fbcaf07c52 AS configuration
WORKDIR /work
COPY container/haproxy.cfg /work/haproxy.cfg
FROM haproxy:3.2.6@sha256:7a5f2b4eac999e35d38b0c49040ec885ac2929c6b1a17fde0d1dc2fbcaf07c52
WORKDIR /usr/local/etc/haproxy
COPY --from=configuration /work/haproxy.cfg /usr/local/etc/haproxy/haproxy.cfg
USER 1000:1000
