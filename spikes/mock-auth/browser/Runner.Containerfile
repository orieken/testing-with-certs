# Existing runner has locked browser packages and Playwright. The wrapper resolves
# its local ID before building and records that ID; no unpinned pull is performed.
ARG RUNNER_IMAGE=magic-shop-runner:03
FROM ${RUNNER_IMAGE}
USER root
COPY spikes/mock-auth/browser /work/spikes/mock-auth/browser
COPY testing/api/contracts/validator.ts /work/testing/api/contracts/validator.ts
COPY testing/container/check-artifacts.mjs /work/testing/container/check-artifacts.mjs
COPY contracts/bundled /work/contracts/bundled
RUN node --check /work/spikes/mock-auth/browser/journeys.mjs \
    && node --check /work/spikes/mock-auth/browser/fixtures.mjs \
    && sh -n /work/spikes/mock-auth/browser/trust.sh
RUN mkdir -p /state && chown 1000:1000 /state
USER 1000:1000
ENTRYPOINT ["sh", "/work/spikes/mock-auth/browser/trust.sh"]
