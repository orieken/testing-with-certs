import {test} from '@playwright/test';
import {authentikCaseNames} from '../teaching/provider-matrix.mjs';
import {checkAuthentik} from '../teaching/authentik.mjs';
for(const name of authentikCaseNames)test(name,async({browser,playwright})=>checkAuthentik(browser,name,playwright));
