import {createRequire} from 'node:module';
import {scenarios,journey} from './journeys.mjs';
const {test}=createRequire('/work/testing/package.json')('@playwright/test');
for(const scenario of scenarios.filter(value=>!process.env.PRISM_SCENARIO||value===process.env.PRISM_SCENARIO))test(`TEST-07 ${scenario}`,async({browser})=>journey(browser,scenario,'playwright'));
