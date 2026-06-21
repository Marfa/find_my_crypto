/** ponytail: Polkadot account balance + staking via state_getStorage (Sidecar REST is often down) */
import { base58Decode, base58Encode } from './base58.js';
import { blake2b } from './blake2b.js';
import { polkadotRpcUrl } from './fetch-proxy.js';

const PREFIXES = {
  system: hex('26aa394eea5630e07c48ae0c9558cef7'),
  account: hex('b99d880ec681799c0cf30e8886371da9'),
  staking: hex('5f3e4907f716ac89b6347d15ececedca'),
  ledger: hex('422adb579f1dbf4f3886c5cfa3bb8cc4'),
  nominators: hex('9c6a637f62ae2af1c7e31eed7e96be04'),
};

function hex(s) {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function blake2_128Concat(data) {
  return concat(blake2b(data, 16), data);
}

function storageKey(modulePrefix, itemPrefix, accountId) {
  return `0x${bytesToHex(concat(modulePrefix, itemPrefix, blake2_128Concat(accountId)))}`;
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Decode SS58 → 32-byte account id (Polkadot prefix 0). */
export function decodeSs58Address(address) {
  const data = base58Decode(String(address).trim());
  const prefixLen = data[0] < 64 ? 1 : 2;
  return data.slice(prefixLen, prefixLen + 32);
}

export function encodeSs58Address(accountId, prefix = 0) {
  const body = concat(new Uint8Array([prefix]), accountId);
  const checksum = blake2b(concat(new TextEncoder().encode('SS58PRE'), body), 64).slice(0, 2);
  return base58Encode(concat(body, checksum));
}

function decodeCompact(data, offset = 0) {
  const b = data[offset];
  const mode = b & 0b11;
  if (mode === 0) return [b >> 2, offset + 1];
  if (mode === 1) return [((data[offset + 1] << 8) | (b >> 2)), offset + 2];
  if (mode === 2) return [(data[offset + 1] | (data[offset + 2] << 8) | (data[offset + 3] << 16)) >> 2, offset + 4];
  const len = (b >> 2) + 4;
  let v = 0n;
  for (let i = 0; i < len; i += 1) v |= BigInt(data[offset + 1 + i]) << BigInt(i * 8);
  return [Number(v), offset + 1 + len];
}

async function rpcCall(method, params, signal) {
  const url = polkadotRpcUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal,
  });
  if (!res.ok) throw new Error(`polkadot_rpc_${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'polkadot_rpc_error');
  return data.result;
}

async function getStorage(key, signal) {
  const hexData = await rpcCall('state_getStorage', [key], signal);
  if (!hexData) return null;
  return hex(hexData.slice(2));
}

function decodeAccountBalance(raw) {
  let off = 0;
  for (let i = 0; i < 4; i += 1) [, off] = decodeCompact(raw, off);
  const [free] = decodeCompact(raw, off);
  return free / 1e10;
}

function decodeLedgerActive(raw) {
  let off = 32;
  [, off] = decodeCompact(raw, off);
  const [active] = decodeCompact(raw, off);
  return active / 1e10;
}

function decodeFirstValidator(raw) {
  const [count, off] = decodeCompact(raw, 0);
  if (!count) return null;
  const id = raw.slice(off, off + 32);
  return encodeSs58Address(id);
}

/** @returns {{ freeDot: number|null, stakedDot: number|null, validator: string|null }} */
export async function queryPolkadotAccount(address, signal) {
  const accountId = decodeSs58Address(address);
  const accountKey = storageKey(PREFIXES.system, PREFIXES.account, accountId);
  const ledgerKey = storageKey(PREFIXES.staking, PREFIXES.ledger, accountId);
  const nominatorsKey = storageKey(PREFIXES.staking, PREFIXES.nominators, accountId);

  const [accountRaw, ledgerRaw, nominatorsRaw] = await Promise.all([
    getStorage(accountKey, signal).catch(() => null),
    getStorage(ledgerKey, signal).catch(() => null),
    getStorage(nominatorsKey, signal).catch(() => null),
  ]);

  const freeDot = accountRaw ? decodeAccountBalance(accountRaw) : 0;
  const stakedDot = ledgerRaw ? decodeLedgerActive(ledgerRaw) : 0;
  const validator = nominatorsRaw ? decodeFirstValidator(nominatorsRaw) : null;

  return {
    freeDot: freeDot > 0 ? freeDot : null,
    stakedDot: stakedDot > 0 ? stakedDot : null,
    validator,
  };
}

export function selfCheckPolkadotRpc() {
  const id = decodeSs58Address('13tZJbtczUaqa2ZN586Fvig25w5FARFWhfAMP8UkSYn4AHyt');
  console.assert(id.length === 32, 'ss58 decode len');
  return 'ok';
}
