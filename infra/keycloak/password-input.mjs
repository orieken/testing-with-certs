export function readPassword(prompt) {
  if (!process.stdin.isTTY) throw new Error('Password setup requires an interactive container terminal');
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function finish(error) {
      process.stdin.off('data', receive);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    }
    function receive(buffer) {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004') return finish(new Error('Password input cancelled'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && value.length < 1024) value += character;
      }
    }
    process.stdin.on('data', receive);
  });
}
