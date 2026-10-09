import { After, Before, type ITestCaseHookParameter } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { SaturdayWorld } from '@orieken/saturday-cucumber';
import { certificateContextOptions } from './playwright.js';
import type { AuthenticationTarget, CertificateProvider, IdentityRef } from './core.js';

export type CertificateWorld = SaturdayWorld & { context?: BrowserContext; page: Page };
export type CucumberIdentityOptions = Readonly<{
  browser: () => Browser;
  provider: CertificateProvider;
  target: AuthenticationTarget;
  resolveIdentity: (scenario: ITestCaseHookParameter) => IdentityRef;
}>;

export function createCertificateCucumberHooks(options: CucumberIdentityOptions) {
  const before = async function (this: CertificateWorld, scenario: ITestCaseHookParameter): Promise<void> {
    const ref = options.resolveIdentity(scenario);
    const context = await options.browser().newContext(await certificateContextOptions(options.provider, ref, options.target));
    try {
      this.context = context;
      this.page = await context.newPage();
      this.request = context.request;
      this.feature = scenario.pickle;
      this.scenarioName = scenario.pickle.name.replace(/\s+/g, '_');
      this.initializeManagers();
    } catch (error) { await context.close(); throw error; }
  };
  const after = async function (this: CertificateWorld): Promise<void> {
    try { await this.cleanupManagers(); } finally { await this.context?.close(); this.context = undefined; }
  };
  return { before, after };
}

/** Register after the consumer installs SaturdayWorld; do not install Saturday's default context hook. */
export function installCertificateCucumberHooks(options: CucumberIdentityOptions): void {
  const hooks = createCertificateCucumberHooks(options);
  Before(hooks.before);
  After(hooks.after);
}
