import { connect } from 'node:net';
import { setTimeout } from 'node:timers/promises';
for (const port of [5900, 6080]) {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    ready = await new Promise(resolve => {
      const socket = connect({ port, host: '127.0.0.1' });
      socket.setTimeout(500);
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    if (ready) break;
    await setTimeout(100);
  }
  if (!ready) throw new Error('VNC desktop dependency failed readiness');
}
const response = await fetch('http://127.0.0.1:6080/vnc.html');
if (!response.ok || !(await response.text()).includes('noVNC')) throw new Error('noVNC viewer unavailable');
