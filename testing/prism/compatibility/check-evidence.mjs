import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const report=JSON.parse(readFileSync('/reports/compatibility.json'));
assert.equal(report.source,'prism-compatibility-experiment');assert.equal(report.prism,'5.14.2');assert.equal(report.digest,'sha256:87972b6cf73da2c0339fca18f362b6f93118152d652c970fab93ed13cfd55bae');
assert.equal(report.decision,'mock-only; no authenticated proxy routing');
assert.deepEqual(report.specDigests,JSON.parse(readFileSync('/work/contracts/bundled/digests.json')).services);
const expected=['populated','empty','geo2020-valid','salesUTC-valid','structured-403','created-location','bodyless-204','checkout-409','checkout-422','checkout-503','invalid-query','wrong-type-warning','wrong-type-enforced','tuple-enforced','tuple-position-enforced','tuple-type-enforced','date-enforced','date-calendar-enforced','location-enforced','invalid-request-enforced','upstream-501','proxy-tls','proxy-bad-ca','proxy-bad-name','proxy-mtls','tls-controls','credential-strip'];
assert.equal(report.results.length,expected.length);
for(const name of expected)assert.equal(report.results.filter(result=>result.name===name).length,1);
const result=name=>report.results.find(value=>value.name===name);
assert.equal(result('wrong-type-warning').status,200);assert.equal(result('wrong-type-warning').violationHeader,true);
assert.equal(result('wrong-type-enforced').rejectsInvalid,true);assert.equal(result('wrong-type-enforced').violationHeader,true);
assert.equal(result('invalid-request-enforced').upstreamCalls,0);assert.equal(result('upstream-501').canonicalMockFallback,true);
assert.equal(result('proxy-tls').canonicalSuccess,true);
for(const name of ['proxy-bad-ca','proxy-bad-name','proxy-mtls']){assert.equal(result(name).upstreamCalls,0);assert.equal(result(name).canonicalSuccess,false);}
assert.equal(result('tls-controls').prismClientCertificateForwarding,false);
assert.equal(result('credential-strip').syntheticBearerStripped,true);assert.equal(result('credential-strip').cookieStripped,true);
console.log('PASS: TEST-05 gate accounts for 27 compatibility observations and the mock-only trust decision');
