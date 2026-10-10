import {createRequire} from 'node:module';
import {scenarios,journey} from './journeys.mjs';
const {test}=createRequire('/work/testing/package.json')('@playwright/test');
for(const scenario of scenarios.filter(s=>!process.env.MOCK_SCENARIO||s===process.env.MOCK_SCENARIO))test(scenario,async({browser})=>journey(browser,scenario,'playwright'));
