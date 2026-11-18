import { cpSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('./dist/ui/', import.meta.url), { recursive: true });
cpSync(new URL('./src/ui/', import.meta.url), new URL('./dist/ui/', import.meta.url), { recursive: true });
