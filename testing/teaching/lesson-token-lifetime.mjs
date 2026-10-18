import assert from 'node:assert/strict';
export function checkShortAccessLifetime(tokens) {
  const claims = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString());
  assert.equal(claims.exp - claims.iat, 20, 'Issued access-token lifetime must remain exactly 20 seconds');
  // Keycloak reports remaining seconds, which can fall while the response is produced.
  assert.ok(Number.isInteger(tokens.expires_in) && tokens.expires_in > 0 && tokens.expires_in <= 20,
    'Reported remaining lifetime must be positive and bounded by the issued lifetime');
}
