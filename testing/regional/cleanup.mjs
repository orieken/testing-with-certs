import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanup,pool,snapshot } from './database.mjs';
import { context } from './context.mjs';
import { validatePlaywrightResponse } from '../api/contracts/validator.ts';
const customer=await context('identity-customer');
try{const original=JSON.parse(readFileSync('/regional-state/original-profile.json'));const response=await customer.patch('/api/customer/me',{data:{regionId:original.regionId,location:original.location}});await validatePlaywrightResponse('customer','updateMyProfile',200,response);await cleanup();assert.equal((await snapshot()).length,0);console.log('Regional fixtures removed and original profile restored through real API');}finally{await customer.dispose();await pool.end();}
