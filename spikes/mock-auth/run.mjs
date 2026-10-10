// Bound each consumer, including unexpected hangs; the shell trap cleans the project.
const deadline=setTimeout(()=>{console.error('Mock consumer overall deadline exceeded');process.exit(1);},90000);
deadline.unref();
const mode=process.argv[2];
if(mode==='jwt') (await import('./jwt.mjs')).runJwt();
else if(mode==='oidc') await (await import('./oidc.mjs')).runOidc();
else if(mode==='api') await (await import('./api.mjs')).runApi();
else if(mode==='prepare') await import('./prepare.mjs');
else throw new Error('Expected jwt|oidc|api|prepare');
