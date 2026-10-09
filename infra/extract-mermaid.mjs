import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts/diagrams');
mkdirSync(output, { recursive: true });
let count = 0;
for (const name of ['architecture', 'workflows']) {
  const markdown = readFileSync(resolve(root, `docs/${name}.md`), 'utf8');
  const blocks = [...markdown.matchAll(/^```mermaid\s*\n([\s\S]*?)^```/gm)];
  if (!blocks.length) throw new Error(`No Mermaid blocks in docs/${name}.md`);
  for (const [index, match] of blocks.entries()) {
    const destination = resolve(output, `${name}-${String(index + 1).padStart(2, '0')}.mmd`);
    writeFileSync(destination, match[1]);
    count++;
  }
}
console.log(`Extracted ${count} Mermaid blocks from docs/architecture.md and docs/workflows.md`);
