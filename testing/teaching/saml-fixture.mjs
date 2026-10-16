import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';

const saml = 'urn:oasis:names:tc:SAML:2.0:assertion';
const protocol = 'urn:oasis:names:tc:SAML:2.0:protocol';
const ds = 'http://www.w3.org/2000/09/xmldsig#';
const canonical = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const serialize = node => new XMLSerializer().serializeToString(node);
const one = (node, namespace, name) => {
  const values = node.getElementsByTagNameNS(namespace, name);
  if (values.length !== 1) throw new Error(`Expected one SAML fixture ${name}`);
  return values.item(0);
};

// Valid fixtures are captured only from this disposable IdP. Do not use as a general SAML validator.
export function resignSamlResponse(xml, variant, { privateKey, certificate }) {
  if (!['control', 'wrong-audience', 'wrong-recipient', 'expired'].includes(variant)) throw new Error('Unknown SAML fixture variant');
  if (typeof xml !== 'string' || xml.length > 100_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Invalid SAML fixture input');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const response = one(document, protocol, 'Response');
  const assertion = one(response, saml, 'Assertion');
  const audience = one(assertion, saml, 'Audience');
  const confirmation = one(assertion, saml, 'SubjectConfirmationData');
  const conditions = one(assertion, saml, 'Conditions');
  if (variant === 'wrong-audience') audience.textContent = 'https://wrong-audience.lesson.invalid/';
  if (variant === 'wrong-recipient') confirmation.setAttribute('Recipient', 'https://wrong-recipient.lesson.invalid/');
  if (variant === 'expired') {
    const now = Date.now();
    conditions.setAttribute('NotBefore', new Date(now - 900_000).toISOString());
    conditions.setAttribute('NotOnOrAfter', new Date(now - 600_000).toISOString());
    confirmation.setAttribute('NotOnOrAfter', new Date(now - 600_000).toISOString());
  }
  for (const signature of Array.from(document.getElementsByTagNameNS(ds, 'Signature'))) signature.parentNode.removeChild(signature);
  let output = serialize(document);
  // Sign the inner assertion first, then the response containing that signature.
  for (const name of ['Assertion', 'Response']) {
    const signer = new SignedXml({ privateKey, publicCert: certificate,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256', canonicalizationAlgorithm: canonical });
    signer.addReference({ xpath: `//*[local-name()='${name}']`,
      transforms: [`${ds}enveloped-signature`, canonical], digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });
    signer.computeSignature(output, { location: { reference: `//*[local-name()='${name}']/*[local-name()='Issuer']`, action: 'after' } });
    output = signer.getSignedXml();
  }
  verifyFixtureSignatures(output, certificate);
  return output;
}

export function verifyFixtureSignatures(xml, certificate) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const signatures = Array.from(doc.getElementsByTagNameNS(ds, 'Signature'));
  if (signatures.length !== 2) throw new Error('Expected both SAML fixture signatures');
  for (const signature of signatures) {
    const verifier = new SignedXml({ publicCert: certificate, getCertFromKeyInfo: () => null });
    verifier.loadSignature(signature);
    if (!verifier.checkSignature(xml)) throw new Error('SAML fixture signature verification failed');
  }
}
