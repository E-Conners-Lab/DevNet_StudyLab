import { crc32, deflateRawSync } from 'node:zlib';

/** A small deterministic ZIP writer; no shell or package install required. */
export function createZip(files) {
  const entries = [], directory = [], seen = new Set();
  let offset = 0;
  for (const file of files) {
    if (!file.path || /[\\\u0000-\u001f]/.test(file.path) || file.path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid ZIP path.');
    if (seen.has(file.path)) throw new Error('ZIP duplicate path.');
    seen.add(file.path);
    const name = Buffer.from(file.path), packed = deflateRawSync(file.data, { level: 9 });
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc32(file.data), 14); header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(file.data.length, 22); header.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    header.copy(central, 8, 6, 28); central.writeUInt32LE(offset, 42);
    entries.push(header, name, packed); directory.push(central, name);
    offset += header.length + name.length + packed.length;
  }
  const centralBytes = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...entries, centralBytes, end]);
}
