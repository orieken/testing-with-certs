// Records live output from a new browserless test execution; never plays old logs.
import { createRequire } from 'node:module';
import { readFile, writeFile, rename } from 'node:fs/promises';
const require=createRequire('/work/testing/package.json');
const { chromium }=require('@playwright/test');
const mode='reporting';
const lesson={title:'TEST-06/09 · Real insights with scripted reporting pages',mock:'Mokapi replaces reporting page contents after real service authorization',proof:'Revision/conflict/outage/cursor sequences · no partial totals · explicit recovery · page/record bounds',limit:'Local Docker emulation; not a browser checkout journey, real outage or native Linux run'};
const deadline=setTimeout(()=>{console.error('Recording deadline exceeded');process.exit(1);},360000);
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'/recordings',size:{width:1440,height:900}}});
const page=await context.newPage();
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#101827;color:#edf2fa;font-family:Arial,sans-serif;padding:30px}
h1{font-size:30px;margin:0 0 12px}.tag{color:#80d9ff;font-size:16px;letter-spacing:1px}
.meta{font-size:18px;line-height:1.6;margin:16px 0}.meta b{color:#99ddff}
#status{font-size:21px;font-weight:bold;color:#ffd782;margin:15px 0}pre{background:#050c18;border:1px solid #36485e;border-radius:12px;padding:22px;height:490px;overflow:hidden;font:17px/1.45 monospace;white-space:pre-wrap;overflow-wrap:anywhere}
footer{color:#aab9cb;font-size:16px}
</style></head><body><div class="tag">NEW EXECUTION · LIVE OUTPUT VIEWER · REAL INSIGHTS / MOCK DEPENDENCY PAGES / VERIFIED TLS</div><h1>${lesson.title}</h1><div class="meta"><b>Mocked:</b> ${lesson.mock}<br><b>Assertions:</b> ${lesson.proof}<br><b>Limit:</b> ${lesson.limit}</div><div id="status">Ready to execute</div><pre id="output">$ ./testing/faults/reporting/run.sh</pre><footer>Video shows live container test output. Chrome is only the output viewer; no application login is recorded.</footer></body></html>`);
await writeFile('/recordings/ready','ready');
let result;
while(result===undefined){
  const raw=await readFile('/recordings/execution.txt','utf8').catch(()=> '');
  // Suppress routine build-layer/Compose noise, retaining checks, assertions and failures.
  const lines=raw.replace(/\u001b\[[0-9;]*m/g,'').split('\n').filter(line=>
    /^Checkout runner|^TEST-0[69]|^live-contracts:|Ajv|^Disposable project cleanup verified|passed|PASS:|validated in|Running \d+ tests|✓|Error|Assertion|deadline|failed|violates|exceeded/.test(line));
  const shown=`$ ./testing/faults/reporting/run.sh\n\n${lines.slice(-16).join('\n') || 'Container build and disposable real stack setup in progress…'}`;
  await page.evaluate(text=>{const output=document.getElementById('output');output.textContent=text;output.scrollTop=output.scrollHeight;document.getElementById('status').textContent='RUNNING · live output';},shown);
  const exit=await readFile('/recordings/exit-code','utf8').catch(()=>undefined);
  if(exit!==undefined)result=Number(exit.trim());
  else await new Promise(resolve=>setTimeout(resolve,250));
}
await page.evaluate(code=>{const status=document.getElementById('status');status.textContent=code===0?'PASS · real insights consumer assertions · project cleanup verified':'FAILED · exit '+code;status.style.color=code===0?'#8ee0a1':'#ff9a9a';},result);
await new Promise(resolve=>setTimeout(resolve,5000));
const video=page.video();
await context.close();
await rename(await video.path(),`/recordings/${mode}.webm`);
await browser.close();clearTimeout(deadline);
console.log(`Recorded ${mode}: exit ${result}`);
if(result!==0)process.exit(result);
