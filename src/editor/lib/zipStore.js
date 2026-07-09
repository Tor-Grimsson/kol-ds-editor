/**
 * zipStore — minimal STORE-only (no compression) ZIP writer.
 *
 * Takes [{ name, data: Uint8Array }] and returns a Blob of a valid .zip:
 * a local file header + data per entry, then a central directory, then the
 * end-of-central-directory record — with a real CRC32 per entry. No
 * dependency: the batch PNG export bundles many rendered blobs into one
 * download.
 *
 * Store-only is deliberate. PNGs are already DEFLATE-compressed internally,
 * so zip-level compression would buy ~nothing while pulling a compressor in.
 * `compressed size === uncompressed size` and the method field stays 0.
 *
 * Layout (PKZIP APPNOTE, no Zip64 — batch exports are well under 4 GB):
 *   [local header + data] × N   →   [central dir record] × N   →   EOCD
 *
 * Self-check: run `demo()` (node-safe) — it asserts CRC32 known-answers plus
 * the local-header offsets / EOCD entry count of a fixed 2-file zip.
 */

/* Standard PKZIP/zlib CRC32 (reflected, poly 0xEDB88320), table-driven. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const encoder = new TextEncoder()

/* Fixed DOS timestamp (1980-01-01 00:00). Zip readers don't require a live
 * clock; a constant keeps output byte-stable for the self-check. */
const DOS_TIME = 0
const DOS_DATE = 0x21

/* Core writer → one concatenated Uint8Array. `makeZip` wraps it in a Blob;
 * keeping the byte builder separate lets the node self-check assert offsets
 * without touching Blob. */
export function zipBytes(entries) {
  const files = entries.map((e) => {
    const nameBytes = encoder.encode(e.name)
    const data = e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data)
    return { nameBytes, data, crc: crc32(data) }
  })

  const chunks = []
  const central = []
  let offset = 0

  for (const f of files) {
    const localOffset = offset
    const header = new Uint8Array(30 + f.nameBytes.length)
    const dv = new DataView(header.buffer)
    dv.setUint32(0, 0x04034b50, true)      // local file header signature
    dv.setUint16(4, 20, true)              // version needed to extract (2.0)
    dv.setUint16(6, 0, true)               // general purpose flags
    dv.setUint16(8, 0, true)               // compression method: 0 = store
    dv.setUint16(10, DOS_TIME, true)
    dv.setUint16(12, DOS_DATE, true)
    dv.setUint32(14, f.crc, true)
    dv.setUint32(18, f.data.length, true)  // compressed size (== uncompressed)
    dv.setUint32(22, f.data.length, true)  // uncompressed size
    dv.setUint16(26, f.nameBytes.length, true)
    dv.setUint16(28, 0, true)              // extra field length
    header.set(f.nameBytes, 30)
    chunks.push(header, f.data)
    offset += header.length + f.data.length

    const cd = new Uint8Array(46 + f.nameBytes.length)
    const cdv = new DataView(cd.buffer)
    cdv.setUint32(0, 0x02014b50, true)     // central directory header signature
    cdv.setUint16(4, 20, true)             // version made by
    cdv.setUint16(6, 20, true)             // version needed to extract
    cdv.setUint16(8, 0, true)              // flags
    cdv.setUint16(10, 0, true)             // method: store
    cdv.setUint16(12, DOS_TIME, true)
    cdv.setUint16(14, DOS_DATE, true)
    cdv.setUint32(16, f.crc, true)
    cdv.setUint32(20, f.data.length, true)
    cdv.setUint32(24, f.data.length, true)
    cdv.setUint16(28, f.nameBytes.length, true)
    cdv.setUint16(30, 0, true)             // extra field length
    cdv.setUint16(32, 0, true)             // comment length
    cdv.setUint16(34, 0, true)             // disk number start
    cdv.setUint16(36, 0, true)             // internal attributes
    cdv.setUint32(38, 0, true)             // external attributes
    cdv.setUint32(42, localOffset, true)   // offset of local header
    cd.set(f.nameBytes, 46)
    central.push(cd)
  }

  const cdStart = offset
  let cdSize = 0
  for (const cd of central) { chunks.push(cd); cdSize += cd.length; offset += cd.length }

  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true)       // end of central directory signature
  edv.setUint16(4, 0, true)                // number of this disk
  edv.setUint16(6, 0, true)                // disk with central directory
  edv.setUint16(8, files.length, true)     // central dir entries on this disk
  edv.setUint16(10, files.length, true)    // total central dir entries
  edv.setUint32(12, cdSize, true)          // central directory size
  edv.setUint32(16, cdStart, true)         // central directory offset
  edv.setUint16(20, 0, true)               // .zip comment length
  chunks.push(eocd)

  const total = offset + eocd.length
  const out = new Uint8Array(total)
  let p = 0
  for (const c of chunks) { out.set(c, p); p += c.length }
  return out
}

export function makeZip(entries) {
  return new Blob([zipBytes(entries)], { type: 'application/zip' })
}

/* Known-answer self-check (node-safe: only TextEncoder / DataView / typed
 * arrays). Asserts CRC32 constants and the exact byte offsets of a fixed
 * 2-file store zip. Throws on any mismatch; returns true on success. */
export function demo() {
  const assert = (cond, msg) => { if (!cond) throw new Error('zipStore demo: ' + msg) }
  const enc = new TextEncoder()

  // CRC32 known answers (PKZIP/zlib).
  assert(crc32(new Uint8Array(0)) === 0x00000000, 'crc32("") should be 0')
  assert(crc32(enc.encode('hello')) === 0x3610a686, 'crc32("hello")')
  assert(crc32(enc.encode('world!')) === 0x718498e8, 'crc32("world!")')

  const a = enc.encode('hello')  // 5 bytes
  const b = enc.encode('world!') // 6 bytes
  const bytes = zipBytes([{ name: 'a.txt', data: a }, { name: 'b.txt', data: b }])
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // File 1 local header at 0; file 2 header at 30 + 5(name) + 5(data) = 40.
  assert(dv.getUint32(0, true) === 0x04034b50, 'file 1 local header signature')
  assert(dv.getUint32(40, true) === 0x04034b50, 'file 2 local header at offset 40')

  // Central directory starts after file 2 = 40 + 30 + 5(name) + 6(data) = 81.
  const cdStart = 81
  assert(dv.getUint32(cdStart, true) === 0x02014b50, 'central dir record 1 signature')
  assert(dv.getUint32(cdStart + 42, true) === 0, 'CD entry 1 local-header offset == 0')
  // CD record 1 length = 46 + 5(name) = 51 → record 2 at cdStart + 51.
  assert(dv.getUint32(cdStart + 51 + 42, true) === 40, 'CD entry 2 local-header offset == 40')

  // EOCD is the final 22 bytes.
  const eocd = bytes.length - 22
  assert(dv.getUint32(eocd, true) === 0x06054b50, 'EOCD signature')
  assert(dv.getUint16(eocd + 10, true) === 2, 'EOCD total entries == 2')
  assert(dv.getUint32(eocd + 16, true) === cdStart, 'EOCD central-dir offset == 81')
  return true
}
