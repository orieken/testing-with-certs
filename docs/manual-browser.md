# Selected-user manual browser

The observed local path uses the same pinned amd64 runner image as automated tests. Chrome or Edge runs inside Docker as UID 1000 with a fresh container HOME, native NSS certificate database and brand-specific exact-origin selection policy. The host browser displays only the loopback desktop. No host CA or client certificate is installed.

```sh
./lab up
LAB_VIEWER_PORT=6081 ./lab manual --user customer-waterdeep --browser chrome
./lab viewer-password
```

Open the URL printed by `./lab manual` and enter the retrieved one-session VNC password. The browser opens `https://shop.magic.test:8443`; choose **Sign in with certificate** to use Keycloak's certificate-only login. To switch roles, rerun the manual command with `--user shop-admin --browser msedge`. A new container and password replace the old ones. `LAB_VIEWER_PORT` defaults to 6080; use 6081 if another viewer occupies it. Do not paste the password into logs or reports.

```sh
LAB_VIEWER_PORT=6081 ./lab manual --user shop-admin --browser msedge
./lab viewer-password
./lab manual stop
```

`./lab manual stop` stops and removes the desktop container, including its HOME, cookies, tokens, certificate database and viewer password. Issued certificates remain in isolated Docker volumes until an explicit project reset. Only the selected user volume and public trust volume mount into the manual container, read-only. The only published port is `127.0.0.1:6080` or the selected override. Raw VNC at container port 5900 binds to its own loopback and is not published. No debugging port or Docker socket is mounted.

If startup reports `Selected certificate bundle is incomplete`, verify `./lab pki init` and the chosen seed user. `Selected certificate identity does not match` means the selected user and mounted certificate disagree; start through the `./lab manual` wrapper so Compose receives the same `LAB_USER` used by the browser. A disabled or unknown-user certificate can import but Keycloak must refuse authorization. Browser certificate policy does not bypass issuer trust, server hostname checks, or revocation.

After `./lab pki renew USER`, restart the manual session to import the new PKCS#12 bundle. Existing connections and short-lived issued access tokens do not disappear when a certificate is revoked. `./lab pki revoke USER` publishes the CRL; restart HAProxy and Keycloak, wait for health, then use a fresh browser connection to check rejection. Run destructive lifecycle exercises in an isolated `LAB_PROJECT`, never against a shared learner session.

Apple Silicon Docker Desktop ran the amd64 image under emulation in Prompt 10. Native Linux amd64 and a remote Docker-context viewer tunnel are deferred at the user's request; no remote-tunnel verification is claimed. A future remote viewer must be forwarded through a protected SSH tunnel to local loopback, without publishing it on a public interface or moving certificates to the host.

## UBI9 browser containers

Set `LAB_RUNNER_OS=ubi9` to build and use the UBI9 amd64 runner with Chrome
and Edge. The existing Debian runner remains the default. Docker Compose 2.24.4
or newer is required for the separate desktop's port override.

```sh
./lab up
LAB_RUNNER_OS=ubi9 ./lab manual --user customer-waterdeep --browser chrome
LAB_RUNNER_OS=ubi9 ./lab viewer-password
# Open http://127.0.0.1:6082/vnc.html, then sign in with certificate.
LAB_RUNNER_OS=ubi9 ./lab manual --user shop-admin --browser msedge
LAB_RUNNER_OS=ubi9 ./lab manual stop
```

The UBI9 desktop uses a separate `runner-manual-ubi9` service and defaults to
port 6082, so it can run alongside the Debian desktop on 6080. Set
`LAB_VIEWER_PORT` to choose another free loopback port. Use the same
`LAB_RUNNER_OS` selection for password retrieval and stop commands. Switching
browser or user recreates only that selected desktop.

Automated and recorded suites can use the same image:

```sh
LAB_RUNNER_OS=ubi9 ./lab test --runner playwright --browser chrome --user customer-waterdeep
LAB_RUNNER_OS=ubi9 ./lab test --runner cucumber --browser msedge --user shop-admin
LAB_RUNNER_OS=ubi9 ./lab record chrome customer-waterdeep
```

UBI9 reuses the native NSS certificate import, exact-origin managed policies,
read-only selected identity/trust volumes and password-protected noVNC workflow.
Openbox provides its window manager; Debian uses Fluxbox. Both run as UID 1000.

This is a UBI9-based experimental browser image augmented with CentOS Stream 9
and EPEL desktop packages, not a UBI-only package set. RPM signature checks stay
enabled. Its base and Node version are pinned, but RPM/browser versions currently
resolve from live repositories, unlike the Debian runner's package lock. Each
build records installed RPMs and browser versions under `/work/evidence`.
