import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { validateRef, type IdentityRef } from './core.js';

export type PkiAction = 'provision' | 'renew' | 'revoke';
export class PkiCommandAdapter {
  constructor(private readonly executable: string, private readonly capabilityFile: string, private readonly timeoutMs = 10_000) {
    if (!executable.startsWith('/') || !capabilityFile.startsWith('/')) throw new Error('Absolute container paths required');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) throw new Error('Invalid command timeout');
  }
  async run(action: PkiAction, ref: IdentityRef): Promise<void> {
    validateRef(ref);
    if (!['provision', 'renew', 'revoke'].includes(action)) throw new Error('Invalid PKI action');
    await access(this.executable);
    if (!(await readFile(this.capabilityFile, 'utf8')).trim()) throw new Error('Operator capability missing');
    await new Promise<void>((ok, reject) => {
      const child = spawn(this.executable, [action, ref.namespace, ref.name], { shell: false, stdio: 'ignore', env: { PATH: '/usr/bin:/bin', SATURDAY_OPERATOR_CAPABILITY_FILE: this.capabilityFile } });
      const timer = setTimeout(() => child.kill('SIGKILL'), this.timeoutMs);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); code === 0 ? ok() : reject(new Error('PKI operation failed')); });
    });
  }
}
