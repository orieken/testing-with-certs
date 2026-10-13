ARG RUNNER_IMAGE=magic-shop-runner:03
FROM ${RUNNER_IMAGE}
USER root
COPY testing/prism /work/testing/prism
COPY spikes/mock-auth/browser /work/spikes/mock-auth/browser
COPY testing/api/contracts/validator.ts /work/testing/api/contracts/validator.ts
COPY infra/check-contract-coverage.mjs infra/check-contract-coverage.test.mjs /work/infra/
COPY contracts/bundled /work/contracts/bundled
RUN mkdir -p /fixtures /state && chown 1000:1000 /fixtures /state
USER 1000:1000
ENTRYPOINT ["sh", "/work/testing/prism/trust.sh"]
