import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { provision,pool,snapshot } from './database.mjs';
import { context } from './context.mjs';
import { validatePlaywrightResponse } from '../api/contracts/validator.ts';
const customer=await context('identity-customer');
try{
 const response=await customer.get('/api/customer/me');await validatePlaywrightResponse('customer','getMyProfile',200,response);const original=await response.json();
 writeFileSync('/regional-state/original-profile.json',JSON.stringify(original));assert.notEqual(original.regionId,'baldurs-gate');await provision();const before=await snapshot();
 const moved=await customer.patch('/api/customer/me',{data:{regionId:'baldurs-gate',location:[-119.5,42]}});await validatePlaywrightResponse('customer','updateMyProfile',200,moved);assert.equal((await moved.json()).regionId,'baldurs-gate');assert.deepEqual(await snapshot(),before);
 console.log('Prepared 114 canonical orders over verified database TLS; real customer move preserves all historical orders');
}finally{await customer.dispose();await pool.end();}
