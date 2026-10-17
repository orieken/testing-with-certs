import { lessonSessionPolicy } from './lesson-session-policy.mjs';
export const { start: startOtpSessionPolicy, finish: finishOtpSessionPolicy, verify: verifyOtpSessionPolicy } = lessonSessionPolicy('password-otp-spa');
