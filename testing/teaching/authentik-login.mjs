// A failed provider submission can leave the same browser session at its
// password challenge. Recovery must not require another username screen.
export async function completeAuthentikSignIn({ identityVisible, passwordVisible, identify, submitPassword, accepted, onChallenge = () => {} }) {
  if (await identityVisible()) { onChallenge('identity'); return accepted(); }
  if (await passwordVisible()) { onChallenge('password'); await submitPassword(); }
  else { onChallenge('identification'); await identify(); }
  return accepted();
}
