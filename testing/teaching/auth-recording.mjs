import { browserCases as rfc8705Cases } from '../rfc8705/cases.mjs';
import { authentikCaseNames, authentikPhase } from './provider-matrix.mjs';
import { mkdirSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join, relative } from 'node:path';
import { authPhases, otpCaseNames, otpSessionCaseNames } from './auth-matrix.mjs';

const certificateCases = ['success', 'wrong-password', 'missing', 'wrong', 'disabled', 'unknown', 'unconfigured', 'cookies', 'shop'];
export function recordingSelection(name, method) {
  const allowed = method === 'rfc8705' ? rfc8705Cases : method.startsWith('authentik-') ? authentikCaseNames.filter(name => name.startsWith(`${method}:`)) : method === 'password-totp' ? [...otpCaseNames, ...otpSessionCaseNames] :
    method === 'certificate-password' ? certificateCases : Object.values(authPhases).flat().filter(value => value.startsWith(`${method}:`));
  if (!allowed.includes(name)) throw new Error('Unknown recording case');
  const browser = process.env.LAB_BROWSER;
  if (!['chrome', 'msedge'].includes(browser)) throw new Error('Real browser required for recording');
  const runner = process.argv.some(value => value.includes('cucumber')) ? 'cucumber' : 'playwright';
  const phase = method.startsWith('authentik-') ? authentikPhase(name) : method === 'password-totp' ? (process.env.LAB_OTP_LIFECYCLE === '1' ? 'lifecycle' : 'baseline') :
    process.env.LAB_AUTH_SUITE?.endsWith('-lifecycle') ? 'lifecycle' : process.env.LAB_KERBEROS_DISABLED === '1' ? 'disabled' : 'baseline';
  const root = `/work/artifacts/${method === 'rfc8705' ? 'rfc8705' : method === 'password-totp' ? 'password-otp' : method === 'certificate-password' ? 'certificate-password-ci' : 'auth-lessons'}`;
  return { name, method, browser, runner, phase, root };
}

// Opacity keeps controls actionable for the real tests while excluding provider
// documents from video. Installed before pages navigate, including popup pages.
export function installRecordingPrivacy() {
  const allowed = location.origin === 'https://shop.magic.test:8543' || location.origin === 'https://shop.magic.test:8443';
  if (allowed || location.href === 'about:blank') return;
  const apply = () => {
    if (!document.documentElement || document.getElementById('auth-recording-privacy')) return;
    const style = document.createElement('style'); style.id = 'auth-recording-privacy';
    style.textContent = 'html{background:#14213b!important}body{opacity:0!important}html::before{content:"Authentication step · credential screen hidden from recording";position:fixed;inset:0;display:grid;place-items:center;padding:48px;color:#edf2ff;font:22px system-ui;text-align:center;background:#14213b;pointer-events:none;z-index:2147483647}';
    document.documentElement.appendChild(style);
  };
  apply(); new MutationObserver(apply).observe(document, { childList: true, subtree: true });
}

export async function withAuthRecording(browser, playwright, name, method, run) {
  const selection = recordingSelection(name, method);
  // Certificate/password also supports a non-report manual command.
  if (method === 'certificate-password' && process.env.LAB_PASSWORD_REPORTS !== '1') return run(browser, playwright);
  if (!existsSync(selection.root)) throw new Error('Recording requires the mounted report directory');
  const directory = join(selection.root, 'recordings', `${selection.browser}-${selection.runner}-${selection.phase}`, method,
    `${createHash('sha256').update(name).digest('hex').slice(0, 16)}-${randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  const contexts = [], videos = [];
  const options = { recordVideo: { dir: directory, size: { width: 1280, height: 720 } }, viewport: { width: 1280, height: 720 } };
  async function attach(context) {
    contexts.push(context);
    await context.addInitScript(installRecordingPrivacy);
    const pages = new Set(context.pages());
    context.on('page', page => pages.add(page));
    const close = context.close.bind(context);
    let closed;
    context.close = () => closed ??= (async () => {
      const captures = [...pages].map(page => page.video()).filter(Boolean);
      await close();
      for (const video of captures) {
        const destination = join(directory, `page-${videos.length + 1}.webm`);
        renameSync(await video.path(), destination); videos.push(relative(selection.root, destination));
      }
    })();
    return context;
  }
  const wrappedBrowser = browser && new Proxy(browser, { get(target, key) {
    if (key === 'newContext') return async supplied => attach(await target.newContext({ ...supplied, ...options }));
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  const wrappedPlaywright = playwright && { ...playwright, chromium: new Proxy(playwright.chromium, { get(target, key) {
    if (key === 'launchPersistentContext') return async (profile, supplied) => attach(await target.launchPersistentContext(profile, { ...supplied, ...options }));
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } }) };
  let status = 'failed';
  try { const result = await run(wrappedBrowser, wrappedPlaywright); status = 'passed'; return result; }
  finally {
    for (const context of contexts) await context.close();
    if (!videos.length) throw new Error('Authentication recording missing');
    writeFileSync(join(directory, 'recording.json'), JSON.stringify({ evidence: 'live-authentication-recording',
      auth_type: method, name, browser: selection.browser, runner: selection.runner, phase: selection.phase, status,
      spec: method === 'rfc8705' ? 'rfc8705/browser.spec.mjs' : method.startsWith('authentik-') ? `teaching/authentik${authentikPhase(name)==='lifecycle'?'-lifecycle':''}.mjs` : `teaching/${method === 'password-totp' ? 'password-otp' : method}.mjs`, videos: videos.map(value => value.split('\\').join('/')),
      privacy: 'provider-document-hidden-before-paint',
    }, null, 2));
  }
}
