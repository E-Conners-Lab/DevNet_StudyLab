import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync, crc32 } from 'node:zlib';
import { createZip } from './zip-release.mjs';

test('portable ZIP preserves path, bytes, size and CRC', () => {
  const data = Buffer.from('Local study\n'.repeat(10));
  const zip = createZip([{ path: 'studylab/.env.example', data }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt16LE(8), 8);
  const nameLength = zip.readUInt16LE(26);
  assert.equal(zip.subarray(30, 30 + nameLength).toString(), 'studylab/.env.example');
  const bytes = inflateRawSync(zip.subarray(30 + nameLength, 30 + nameLength + zip.readUInt32LE(18)));
  assert.deepEqual(bytes, data);
  assert.equal(zip.readUInt32LE(14), crc32(data));
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
});
test('ZIP rejects ambiguous and traversal filenames', () => {
  for (const path of ['../secret', '/etc/test', 'a/../b', 'a\\b', 'a//b']) assert.throws(() => createZip([{path, data: Buffer.from('x')}]), /path/);
  assert.throws(() => createZip([{path:'a',data:Buffer.alloc(0)}, {path:'a',data:Buffer.alloc(0)}]), /duplicate/);
});
