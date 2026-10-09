// Local ZIP codec. Exports use method 0 (stored); imports accept stored and bounded deflate.
// No CDN, executable archive entries, ZIP64, encryption, symlink or descriptor ambiguity.
const MAX_COMPRESSED = 20 * 1048576,
  MAX_EXPANDED = 50 * 1048576;
export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function u16(b: Uint8Array, o: number, n: number) {
  new DataView(b.buffer, b.byteOffset, b.byteLength).setUint16(o, n, true);
}
function u32(b: Uint8Array, o: number, n: number) {
  new DataView(b.buffer, b.byteOffset, b.byteLength).setUint32(o, n, true);
}
function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let i = 0;
  for (const b of parts) {
    out.set(b, i);
    i += b.length;
  }
  return out;
}
export function zipFiles(files: Map<string, Uint8Array>): Uint8Array {
  const local: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const [path, data] of files) {
    const name = new TextEncoder().encode(path),
      l = new Uint8Array(30 + name.length),
      c = new Uint8Array(46 + name.length),
      crc = crc32(data);
    u32(l, 0, 0x04034b50);
    u16(l, 4, 20);
    u16(l, 6, 0x800);
    u32(l, 14, crc);
    u32(l, 18, data.length);
    u32(l, 22, data.length);
    u16(l, 26, name.length);
    l.set(name, 30);
    u32(c, 0, 0x02014b50);
    u16(c, 4, 20);
    u16(c, 6, 20);
    u16(c, 8, 0x800);
    u32(c, 16, crc);
    u32(c, 20, data.length);
    u32(c, 24, data.length);
    u16(c, 28, name.length);
    u32(c, 42, offset);
    c.set(name, 46);
    local.push(l, data);
    central.push(c);
    offset += l.length + data.length;
  }
  const directory = concat(central),
    end = new Uint8Array(22);
  u32(end, 0, 0x06054b50);
  u16(end, 8, files.size);
  u16(end, 10, files.size);
  u32(end, 12, directory.length);
  u32(end, 16, offset);
  const out = concat([...local, directory, end]);
  if (out.length > MAX_COMPRESSED) throw Error("export_zip_size_limit");
  return out;
}
export async function unzipFiles(
  bytes: Uint8Array,
  allowlist: readonly string[],
): Promise<Map<string, Uint8Array>> {
  if (bytes.length > MAX_COMPRESSED || bytes.length < 22)
    throw Error("zip_size_limit");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    r16 = (o: number) => view.getUint16(o, true),
    r32 = (o: number) => view.getUint32(o, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (r32(i) === 0x06054b50 && i + 22 + r16(i + 20) === bytes.length) {
      end = i;
      break;
    }
  if (
    end < 0 ||
    r16(end + 4) !== 0 ||
    r16(end + 6) !== 0 ||
    r16(end + 8) !== r16(end + 10)
  )
    throw Error("invalid_zip_directory");
  const count = r16(end + 10),
    size = r32(end + 12),
    start = r32(end + 16);
  if (count !== allowlist.length || start + size !== end)
    throw Error("zip_file_count_or_directory");
  const output = new Map<string, Uint8Array>(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let offset = start,
    total = 0;
  const ranges: { start: number; end: number }[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || r32(offset) !== 0x02014b50)
      throw Error("invalid_zip_entry");
    const flags = r16(offset + 8),
      method = r16(offset + 10),
      compressed = r32(offset + 20),
      expanded = r32(offset + 24),
      n = r16(offset + 28),
      extra = r16(offset + 30),
      comment = r16(offset + 32),
      local = r32(offset + 42),
      attrs = r32(offset + 38);
    if (
      offset + 46 + n + extra + comment > end ||
      ![0, 0x800].includes(flags) ||
      ![0, 8].includes(method) ||
      ((attrs >>> 16) & 0xf000) === 0xa000 ||
      r16(offset + 34) !== 0
    )
      throw Error("unsupported_zip_entry");
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + n));
    if (
      !allowlist.includes(path) ||
      output.has(path) ||
      path.includes("..") ||
      path.includes("\\") ||
      path.startsWith("/")
    )
      throw Error("zip_path_or_duplicate");
    total += expanded;
    if (
      total > MAX_EXPANDED ||
      expanded > MAX_EXPANDED ||
      expanded > Math.max(1, compressed) * 100
    )
      throw Error("zip_bomb_limit");
    if (
      local + 30 > start ||
      r32(local) !== 0x04034b50 ||
      r16(local + 6) !== flags ||
      r16(local + 8) !== method ||
      r32(local + 14) !== r32(offset + 16) ||
      r32(local + 18) !== compressed ||
      r32(local + 22) !== expanded ||
      r16(local + 26) !== n
    )
      throw Error("zip_local_mismatch");
    const from = local + 30 + n + r16(local + 28),
      to = from + compressed;
    if (
      to > start ||
      decoder.decode(bytes.subarray(local + 30, local + 30 + n)) !== path ||
      ranges.some((r) => local < r.end && to > r.start)
    )
      throw Error("zip_overlap_or_name");
    ranges.push({ start: local, end: to });
    let data = bytes.slice(from, to);
    if (method === 8) {
      const stream = new Blob([new Uint8Array(data)])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader();
      const parts: Uint8Array[] = [];
      let used = 0;
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          used += next.value.length;
          if (used > expanded || used > MAX_EXPANDED) {
            await reader.cancel();
            throw Error("zip_inflation_limit");
          }
          parts.push(next.value);
        }
        data = concat(parts);
      } finally {
        reader.releaseLock();
      }
    }
    if (data.length !== expanded || crc32(data) !== r32(offset + 16))
      throw Error("zip_crc_or_size");
    output.set(path, data);
    offset += 46 + n + extra + comment;
  }
  if (offset !== end || output.size !== allowlist.length)
    throw Error("zip_directory_end");
  return output;
}
