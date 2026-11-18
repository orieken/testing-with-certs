import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import type { Attachment } from './model.js';

const extensions: Record<string, string> = {
  'video/webm': '.webm', 'video/mp4': '.mp4', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
};
export function inside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}
/** Check every existing ancestor, including a symlinked directory above the file. */
export function rejectSymlinks(target: string): void {
  const absolute = resolve(target);
  let current = parse(absolute).root;
  for (const part of absolute.slice(current.length).split(sep)) {
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error('Report paths must not contain symlinks');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
export function portableAttachment(attachment: Attachment, destination: string, roots: string[]): Attachment {
  const saved: Attachment = { name: attachment.name, contentType: attachment.contentType };
  if (attachment.availability === 'disabled' || attachment.availability === 'omitted') return { ...saved, availability: attachment.availability };
  const extension = extensions[attachment.contentType];
  if (!extension) return { ...saved, availability: 'omitted' };
  let bytes = attachment.body;
  if (attachment.path !== undefined) {
    const source = resolve(attachment.path);
    if (!roots.some(root => inside(root, source))) throw new Error('Attachment escapes configured artifact roots');
    rejectSymlinks(source);
    if (!existsSync(source)) return { ...saved, availability: 'missing' };
    if (!lstatSync(source).isFile()) throw new Error('Attachment must be a regular file');
    bytes = readFileSync(source);
  }
  if (!bytes?.byteLength) return { ...saved, availability: 'missing' };
  const hash = createHash('sha256').update(bytes).digest('hex');
  const path = `media/${hash}${extension}`;
  mkdirSync(join(destination, 'media'), { recursive: true });
  writeFileSync(join(destination, path), bytes);
  return { ...saved, path, availability: 'available' };
}
