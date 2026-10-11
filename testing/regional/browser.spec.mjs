import { test } from '@playwright/test';
import { scenarios,journey } from './journeys.mjs';
for(const scenario of scenarios)test(`TEST-10 ${scenario}`,async({browser})=>journey(browser,scenario,'playwright'));
