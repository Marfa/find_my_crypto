/** ponytail: minimal blake2b (digest sizes 16/32/64) — MIT, adapted from blakejs */

const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];

function rotr(n, b) {
  return ((n >>> b) | (n << (32 - b))) >>> 0;
}

function blake2bCompress(state, m, t, f, rounds) {
  const v = new Uint32Array(16);
  for (let i = 0; i < 8; i += 1) v[i] = state[i];
  for (let i = 0; i < 8; i += 1) v[i + 8] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19][i] ^ state[i];
  v[12] ^= t[0]; v[13] ^= t[1]; v[14] ^= f[0]; v[15] ^= f[1];
  function g(a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) >>> 0;
    v[d] = rotr(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = rotr(v[b] ^ v[c], 12);
    v[a] = (v[a] + v[b] + y) >>> 0;
    v[d] = rotr(v[d] ^ v[a], 8);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = rotr(v[b] ^ v[c], 7);
  }
  for (let r = 0; r < rounds; r += 1) {
    const s = SIGMA[r % 10];
    g(0, 4, 8, 12, m[s[0]], m[s[1]]); g(1, 5, 9, 13, m[s[2]], m[s[3]]);
    g(2, 6, 10, 14, m[s[4]], m[s[5]]); g(3, 7, 11, 15, m[s[6]], m[s[7]]);
    g(0, 5, 10, 15, m[s[8]], m[s[9]]); g(1, 6, 11, 12, m[s[10]], m[s[11]]);
    g(2, 7, 8, 13, m[s[12]], m[s[13]]); g(3, 4, 9, 14, m[s[14]], m[s[15]]);
  }
  for (let i = 0; i < 8; i += 1) state[i] ^= v[i] ^ v[i + 8];
}

export function blake2b(input, outLen = 32, key = new Uint8Array(0)) {
  const state = new Uint32Array([
    0x6a09e667 ^ ((outLen | (key.length << 8) | (1 << 16) | (1 << 24)) >>> 0),
    0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const block = new Uint8Array(128);
  let offset = 0;
  let t = [0, 0];
  const data = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  if (key.length) {
    block.set(key); offset = 128;
  }
  let pos = 0;
  while (pos < data.length) {
    const take = Math.min(128 - offset, data.length - pos);
    block.set(data.subarray(pos, pos + take), offset);
    offset += take; pos += take;
    if (offset === 128) {
      t[0] = (t[0] + 128) >>> 0;
      if (t[0] < 128) t[1] += 1;
      const m = new Uint32Array(16);
      for (let i = 0; i < 16; i += 1) m[i] = block[i * 4] | (block[i * 4 + 1] << 8) | (block[i * 4 + 2] << 16) | (block[i * 4 + 3] << 24);
      blake2bCompress(state, m, t, [0, 0], 12);
      offset = 0;
    }
  }
  t[0] = (t[0] + offset) >>> 0;
  if (t[0] < offset) t[1] += 1;
  block.fill(0, offset);
  block[offset] = 0x01;
  const m = new Uint32Array(16);
  for (let i = 0; i < 16; i += 1) m[i] = block[i * 4] | (block[i * 4 + 1] << 8) | (block[i * 4 + 2] << 16) | (block[i * 4 + 3] << 24);
  blake2bCompress(state, m, t, [0xffffffff, 0xffffffff], 12);
  const out = new Uint8Array(outLen);
  for (let i = 0; i < outLen; i += 1) out[i] = (state[i >> 2] >>> ((i & 3) * 8)) & 0xff;
  return out;
}
