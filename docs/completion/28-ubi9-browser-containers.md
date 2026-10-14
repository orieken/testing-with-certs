# UBI9 browser containers

Added an opt-in UBI9 amd64 runner beside the existing Debian runner. Set
`LAB_RUNNER_OS=ubi9` for `./lab test`, `./lab record`, and `./lab manual`.
The separate `runner-manual-ubi9` service defaults to loopback port 6082, leaving
the Debian desktop independent. Password retrieval and stop use the same OS
selection. See [manual browser instructions](../manual-browser.md#ubi9-browser-containers).

The implementation adapts the UBI9 browser dependency approach from Saturday's
`packages/saturday-playwright-certs/example/Dockerfile`, but installs browser
RPMs with dependency resolution and signature checks. It also verifies the EPEL
bootstrap RPM signature. UBI9 uses Openbox because Fluxbox was unavailable.
Native certificate import, brand-specific managed policy, selected-user mounts,
VNC authentication and non-root execution reuse the existing scripts.

## Validation on October 14, 2026

Docker Desktop on Apple Silicon, running linux/amd64 containers under emulation:

- Final UBI9 image built successfully, including TypeScript runtime compilation.
- Runtime identifies as RHEL 9.6, with Node 24.19.0, Chrome 155.0.8059.79 and
  Edge 155.0.4283.45. RPM and browser inventories are in `/work/evidence`.
- Both browsers passed the existing `native-login.sh` UI flow as
  `customer-waterdeep`: native NSS client certificate selection, verified HTTPS,
  certificate-only sign-in, selected role display and sign-out. These checks use
  the existing live lab and do not inject Playwright client certificates.
- Both browsers passed an automated Playwright video recording check.
- Edge desktop started healthy with `shop-admin`; UBI9-only stop removed it;
  a fresh Chrome desktop then started for `customer-waterdeep`.
- The noVNC page returned HTTP 200, and its WebSocket forwarded an RFB 3.8
  handshake offering VNC password authentication without an unauthenticated mode.
- Existing Debian desktop and application services remained running.
- `node --test testing/ubi9-runner.test.mjs`: three passing checks for read-only
  identity mounts, non-root execution, isolated profiles/ports, lifecycle command
  selection and automated runner image selection.
- Shell syntax, Compose configuration and diff whitespace checks passed.

The initial live test caught missing `xdpyinfo`; the final image installs
`xorg-x11-utils`. Review caught Compose profile inheritance; explicit profile
and port overrides keep the desktops separate. Docker disk pressure during
rebuilds was resolved by removing only this task's obsolete trial image and
its exact cache entries, reclaiming about 2.1 GB.

## Limits

This is an experimental UBI9-based image augmented with CentOS Stream 9 and EPEL
packages. It is not a UBI-only package set. Base and Node images are pinned;
RPM/browser dependency versions resolve from live repositories and are not yet
locked like the Debian image. All checks above ran under emulation; native
Linux and the full teaching/security suite matrix were not exercised.
