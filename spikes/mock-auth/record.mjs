// Records live output from a new browserless test execution; never plays old logs.
import { createRequire } from 'node:module';
import { readFile, writeFile, rename } from 'node:fs/promises';
const require=createRequire('/work/testing/package.json');
const { chromium }=require('@playwright/test');
const mode=process.argv[2];
const lessons={
  jwt:{title:'FEATURE-01 · Signed JWT',mock:'Ephemeral signing key and synthetic claims',proof:'Valid accepted · expired, wrong audience and altered signature rejected',limit:'Does not prove user login, Keycloak configuration or certificate pairing'},
  oidc:{title:'FEATURE-02 · OIDC dependency',mock:'Standalone NAV OIDC issuer over verified TLS',proof:'Discovery, JWKS, tokens · ten failure cases · recovery',limit:'Does not prove real login, PKCE, passwords or API authorization'},
  api:{title:'FEATURE-03 · API dependency',mock:'Prism catalog responses with a private TLS/fault adapter',proof:'Ajv fixtures · errors · delay · malformed data rejection · recovery',limit:'Does not prove real providers, database effects or Vue behavior'},
};
if(!lessons[mode]) throw new Error('Expected jwt|oidc|api');
const lesson=lessons[mode];
const deadline=setTimeout(()=>{console.error('Recording deadline exceeded');process.exit(1);},180000);
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'/recordings',size:{width:1440,height:900}}});
const page=await context.newPage();
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#101827;color:#edf2fa;font-family:Arial,sans-serif;padding:30px}
h1{font-size:30px;margin:0 0 12px}.tag{color:#80d9ff;font-size:16px;letter-spacing:1px}
.meta{font-size:18px;line-height:1.6;margin:16px 0}.meta b{color:#99ddff}
#status{font-size:21px;font-weight:bold;color:#ffd782;margin:15px 0}pre{background:#050c18;border:1px solid #36485e;border-radius:12px;padding:22px;height:490px;overflow:hidden;font:17px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere}
footer{color:#aab9cb;font-size:16px}
</style></head><body><div class="tag">NEW EXECUTION · BROWSERLESS MOCK-CONSUMER EVIDENCE</div><h1>${lesson.title}</h1><div class="meta"><b>Mocked:</b> ${lesson.mock}<br><b>Assertions:</b> ${lesson.proof}<br><b>Limit:</b> ${lesson.limit}</div><div id="status">Ready to execute</div><pre id="output">$ ./spikes/mock-auth/run.sh ${mode}</pre><footer>Video shows live container test output. Chrome is only the output viewer; no application login is recorded.</footer></body></html>`);
await writeFile('/recordings/ready','ready');
let result;
while(result===undefined){
  const raw=await readFile('/recordings/execution.txt','utf8').catch(()=> '');
  // Suppress routine build-layer/Compose noise, retaining checks, assertions and failures.
  const lines=raw.replace(/\u001b\[[0-9;]*m/g,'').split('\n').filter(line=>
    /MOCK-CONSUMER|Ajv|Cleanup verified|passed|PASS:|validated in|Running \d+ tests|✓|Error|Assertion|deadline|failed|violates|exceeded/.test(line));
  const shown=`$ ./spikes/mock-auth/run.sh ${mode}\n\n${lines.slice(-16).join('\n') || 'Container build and disposable PKI setup in progress…'}`;
  await page.evaluate(text=>{const output=document.getElementById('output');output.textContent=text;output.scrollTop=output.scrollHeight;document.getElementById('status').textContent='RUNNING · live output';},shown);
  const exit=await readFile('/recordings/exit-code','utf8').catch(()=>undefined);
  if(exit!==undefined)result=Number(exit.trim());
  else await new Promise(resolve=>setTimeout(resolve,250));
}
await page.evaluate(code=>{const status=document.getElementById('status');status.textContent=code===0?'PASS · exit 0 · project cleanup verified':'FAILED · exit '+code;status.style.color=code===0?'#8ee0a1':'#ff9a9a';},result);
await new Promise(resolve=>setTimeout(resolve,5000));
const video=page.video();
await context.close();
await rename(await video.path(),`/recordings/${mode}.webm`);
await browser.close();clearTimeout(deadline);
console.log(`Recorded ${mode}: exit ${result}`);
if(result!==0)process.exit(result);
