import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, sep, basename } from 'node:path';

export function browserMediaReceipts(directory, tests) {
  const root = resolve(directory), receipts = [];
  for (const test of tests) for (const attempt of test.attempts) {
    const receipt = { title: test.title, attempt: attempt.index };
    for (const [key, contentType, extension] of [['png','image/png','.png'],['webm','video/webm','.webm']]) {
      const attachments = (attempt.attachments ?? []).filter(item => item.contentType === contentType);
      assert.equal(attachments.length, 1, `One ${key} required for ${test.title} attempt ${attempt.index}`);
      const attachment = attachments[0];
      assert.equal(attachment.availability, 'available', `Missing ${key} for ${test.title} attempt ${attempt.index}`);
      assert.equal(typeof attachment.path, 'string');
      const path = resolve(root, attachment.path);
      assert.ok(path.startsWith(root + sep), 'Media must remain inside the report');
      const bytes = readFileSync(path), hash = createHash('sha256').update(bytes).digest('hex');
      assert.equal(basename(path), hash + extension, 'Media bytes must match their content-addressed path');
      if (key === 'png') {
        assert.ok(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a','hex')), 'Screenshot must be PNG');
        assert.ok(bytes.readUInt32BE(16) >= 640 && bytes.readUInt32BE(20) >= 360, 'Screenshot must contain a real browser viewport');
      } else assert.ok(bytes.subarray(0,4).equals(Buffer.from('1a45dfa3','hex')), 'Recording must be WebM');
      receipt[key] = hash;
    }
    receipts.push(receipt);
  }
  return receipts.sort((left,right) => left.title.localeCompare(right.title) || left.attempt-right.attempt);
}
