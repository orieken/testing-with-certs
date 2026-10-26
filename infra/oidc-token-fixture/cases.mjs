export const upstreamIdTokenKinds = ['signed-control', 'signature', 'unknown-key', 'issuer', 'audience',
  'authorized-party', 'expired', 'not-yet-valid', 'nonce', 'missing-nonce'];
export const upstreamIdTokenCases = upstreamIdTokenKinds.map(kind => `upstream-id-token-${kind}`);
export const jwksCaseNames = ['signing-key-native-rotation', 'jwks-cached-key-outage',
  'jwks-uncached-key-outage', 'jwks-malformed-response', 'jwks-empty-response'];
