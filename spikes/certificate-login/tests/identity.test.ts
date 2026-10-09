import {describe, expect, it} from 'vitest';
import {authorizeIdentity} from '../src/domain/identity.js';
/** @issue prompt-01 @ac Gateway certificate and signed token must identify the same user. */
describe('certificate identity boundary', () => {
  it('accepts a matching customer', () => expect(authorizeIdentity('opaque-1', {certIdentity:'opaque-1', subject:'subject-1', roles:['customer']})).toEqual({subject:'subject-1', roles:['customer']}));
  it('rejects a stolen admin token', () => expect(() => authorizeIdentity('opaque-1', {certIdentity:'opaque-2', subject:'admin', roles:['shop-admin']})).toThrow('identity_mismatch'));
  it.each(['', undefined])('rejects absent identity %s', identity => expect(() => authorizeIdentity(identity, {certIdentity:'opaque-1', subject:'subject-1', roles:[]})).toThrow('identity_mismatch'));
});
