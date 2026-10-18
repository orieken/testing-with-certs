import { passkeyCaseNames, passkeySessionCaseNames } from './auth-matrix.mjs';
const names = new Set([...passkeyCaseNames, ...passkeySessionCaseNames]);
const stages = new Set(['control-ready', 'enrollment-passed', 'enrollment-failed', 'rejection-passed', 'rejection-failed']);
const flags = new Set(['documentComplete', 'focused', 'signatureChanged', 'errorMessage', 'feedback', 'credentialError', 'identity', 'authenticationButton', 'moduleDelayed', 'observationFailed']);
export const diagnosticPrefix = 'PASSKEY_DIAGNOSTIC ';
const events = [];

export function safePasskeyDiagnostic(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !names.has(value.name) || !stages.has(value.stage)) return null;
  if (!Object.keys(value).every(key => ['name', 'stage'].includes(key) || (flags.has(key) && typeof value[key] === 'boolean'))) return null;
  if (!Object.keys(value).some(key => flags.has(key))) return null;
  return { ...value };
}
export function emitPasskeyDiagnostic(name, stage, state) {
  const value = safePasskeyDiagnostic({ ...state, name, stage });
  if (!value) throw new Error('Invalid passkey diagnostic');
  events.push(value);
  console.log(diagnosticPrefix + JSON.stringify(value));
}
export function takePasskeyDiagnostics() { return events.splice(0); }

export class PasskeyDiagnosticLines {
  buffers = new Map();
  read(chunk, test) {
    const key = test?.id;
    if (!key || !names.has(test.title)) return [];
    const text = (this.buffers.get(key) ?? '') + chunk.toString();
    // Never retain unbounded runner output or forward raw stdout.
    if (text.length > 16384) { this.buffers.delete(key); return []; }
    const lines = text.split('\n');
    this.buffers.set(key, lines.pop());
    return lines.flatMap(line => {
      if (!line.startsWith(diagnosticPrefix)) return [];
      try {
        const value = safePasskeyDiagnostic(JSON.parse(line.slice(diagnosticPrefix.length)));
        return value?.name === test.title ? [value] : [];
      } catch { return []; }
    });
  }
  finish(test) { this.buffers.delete(test.id); }
}
