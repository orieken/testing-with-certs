# OIDC skill: mTLS guidance and focused workflow

Validated locally on 2026-10-27 (America/Chicago). This records a focused local Docker run, not native CI or full protocol acceptance.

## Changes

The versioned [OIDC skill](../../skills/oidc-testing/SKILL.md) now routes certificate-related tasks to [mTLS guidance](../../skills/oidc-testing/references/mtls.md). It distinguishes browser X.509 login, gateway/service mTLS, OAuth client authentication, RFC 8705 thumbprint binding and application identity matching. It explains isolated negatives, exact origins, proxy trust, renewal semantics and limitations of generic transport errors.

The dependency-free [helper](../../skills/oidc-testing/scripts/mtls.mjs) makes fresh verified HTTPS readiness probes without redirects or response-body capture, separates TLS errors from network failure, and compares certificate DER thumbprints against already-verified claims. It does not validate JWT signatures itself. Its [local TLS test](../../skills/oidc-testing/scripts/mtls.test.mjs) creates disposable CA/server/client material, checks successful controls, missing client, wrong server trust and hostname, unavailable endpoint classification, claim-binding match/mismatch and input constraints, and removes the temporary keys.

The [workflow](../../testing/run-oidc-mtls.sh) refuses nonempty disposable projects, uses the repository's PKI and real provider setup, runs [transport probes](../../testing/container/oidc-mtls.mjs), Chrome certificate login and the existing API security suite, then removes and independently checks project resources. The installed skill at `~/.codex/skills/oidc-testing` was synchronized with the six changed/added skill files and validated.

## Observed validation

```sh
node --test skills/oidc-testing/scripts/mtls.test.mjs
python3 /Users/oscarrieken/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/oidc-testing
LAB_PROJECT=magic-shop-mtls-skill-20261027-01 sh testing/run-oidc-mtls.sh
```

The localhost helper test passed on host Node 22.22.3 after permission to open its temporary port. Skill structure validation, shell syntax and diff whitespace checks passed. Docker socket access required sandbox escalation; the complete workflow then exited 0.

Observed live results:

- Shop HTTPS returned 200 using the trusted customer certificate before and after the negatives.
- Missing client certificate, wrong server CA and wrong hostname each produced a TLS error rather than an HTTP or network result.
- Real Chrome `customer-waterdeep` certificate-only login completed matching-state authorization code/PKCE exchange, real-provider JWT signature verification, identity/audience/role/lifetime checks and no password fallback.
- All **12/12 existing API security tests passed**, including successful customer requests, invalid/missing tokens, ID-token misuse, separate customer identities, certificate/token mismatch, spoofed identity headers, direct service bypass and role enforcement.
- Teardown reported no project-labeled containers, volumes or networks remaining. The cleanup exit status was 0.

The execution log was captured at `/private/tmp/oidc-mtls-workflow.log` for this local run; that temporary path is not a durable artifact. This document retains the safe results. No browser recording or credential-bearing response was intentionally captured by the workflow.

## Limits

The shop uses `cert_identity` application binding. This does not prove RFC 8705 `cnf.x5t#S256` enforcement or OAuth mTLS client authentication. The thumbprint helper's local checks are not live provider acceptance. The run used Chrome certificate injection in Linux containers on the local host, not native OS certificate selection, Edge/Cucumber parity, federation lesson acceptance, new expiry/revocation/rotation cases or native CI. Failure/interruption teardown branches were inspected but not fault-injected in this validation.
