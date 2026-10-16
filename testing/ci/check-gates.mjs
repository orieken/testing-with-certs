import assert from 'node:assert/strict';
export function check(needs){for(const job of ['integration','certificate-password','password-otp','auth-lessons','consumer','dependency-faults','regional'])assert.equal(needs[job]?.result,'success',`Required independent ${job} gate missing or unsuccessful`);}
if(process.argv[1]?.endsWith('/check-gates.mjs')){check(JSON.parse(process.env.CI_GATE_RESULTS));console.log('PASS: all independent live, security, browser, consumer, fault and regional gates');}
