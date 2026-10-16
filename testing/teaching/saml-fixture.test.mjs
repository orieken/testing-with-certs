import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { resignSamlResponse, verifyFixtureSignatures } from './saml-fixture.mjs';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = { privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  certificate: pair.publicKey.export({ type: 'spki', format: 'pem' }) };
const xml = '<p:Response xmlns:p="urn:oasis:names:tc:SAML:2.0:protocol" ID="response" Destination="https://broker.lesson.invalid/endpoint" InResponseTo="request"><a:Issuer xmlns:a="urn:oasis:names:tc:SAML:2.0:assertion">fixture-idp</a:Issuer><a:Assertion xmlns:a="urn:oasis:names:tc:SAML:2.0:assertion" ID="assertion"><a:Issuer>fixture-idp</a:Issuer><a:Subject><a:NameID>fixture-user</a:NameID><a:SubjectConfirmation><a:SubjectConfirmationData Recipient="https://broker.lesson.invalid/endpoint" InResponseTo="request" NotOnOrAfter="2099-01-01T00:00:00Z"/></a:SubjectConfirmation></a:Subject><a:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"><a:AudienceRestriction><a:Audience>fixture-audience</a:Audience></a:AudienceRestriction></a:Conditions></a:Assertion></p:Response>';
const element = (doc, name) => doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', name).item(0);

test('each semantic variant retains valid assertion/response signatures and request correlation', () => {
  for (const variant of ['control', 'wrong-audience', 'wrong-recipient', 'expired']) {
    const output = resignSamlResponse(xml, variant, key);
    verifyFixtureSignatures(output, key.certificate);
    const doc = new DOMParser().parseFromString(output, 'application/xml');
    assert.equal(doc.documentElement.getAttribute('Destination'), 'https://broker.lesson.invalid/endpoint');
    assert.equal(doc.documentElement.getAttribute('InResponseTo'), 'request');
    assert.equal(element(doc, 'SubjectConfirmationData').getAttribute('InResponseTo'), 'request');
    assert.equal(element(doc, 'NameID').textContent, 'fixture-user');
    assert.equal(element(doc, 'Audience').textContent, variant === 'wrong-audience' ? 'https://wrong-audience.lesson.invalid/' : 'fixture-audience');
    assert.equal(element(doc, 'SubjectConfirmationData').getAttribute('Recipient'), variant === 'wrong-recipient' ? 'https://wrong-recipient.lesson.invalid/' : 'https://broker.lesson.invalid/endpoint');
    const expiry = Date.parse(element(doc, 'Conditions').getAttribute('NotOnOrAfter'));
    assert.equal(expiry < Date.now(), variant === 'expired');
    assert.throws(() => verifyFixtureSignatures(output.replace('fixture-user', 'tampered-user'), key.certificate));
  }
});
test('fixture inputs reject unsupported variants, external entities and ambiguous assertions', () => {
  assert.throws(() => resignSamlResponse(xml, 'unknown', key));
  assert.throws(() => resignSamlResponse(`<!DOCTYPE fixture>${xml}`, 'control', key));
  assert.throws(() => resignSamlResponse(xml.replace('</p:Response>', '<a:Assertion xmlns:a="urn:oasis:names:tc:SAML:2.0:assertion"/></p:Response>'), 'control', key));
});
