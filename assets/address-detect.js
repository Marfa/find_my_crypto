/** ponytail: address family detection; order matters (Solana vs Polkadot both base58) */

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function normalizeAddress(raw) {
  return String(raw).trim();
}

export function isEvmAddress(raw) {
  return /^0x[a-fA-F0-9]{40}$/.test(normalizeAddress(raw));
}

export function isCardanoAddress(raw) {
  return /^(addr1|stake1)[a-z0-9]+$/i.test(normalizeAddress(raw));
}

export function isCosmosAddress(raw) {
  return /^cosmos1[a-z0-9]{38,58}$/i.test(normalizeAddress(raw));
}

export function isNearAddress(raw) {
  const s = normalizeAddress(raw).toLowerCase();
  if (/^[a-f0-9]{64}$/.test(s)) return true;
  return /^[a-z0-9._-]{2,64}$/.test(s) && s.includes('.');
}

export function isPolkadotAddress(raw) {
  const s = normalizeAddress(raw);
  return BASE58.test(s) && s.length >= 46 && s.length <= 50;
}

export function isSolanaAddress(raw) {
  const s = normalizeAddress(raw);
  return BASE58.test(s) && s.length >= 32 && s.length <= 44;
}

export function detectAddressType(raw) {
  const s = normalizeAddress(raw);
  if (isEvmAddress(s)) return 'evm';
  if (isCardanoAddress(s)) return 'cardano';
  if (isCosmosAddress(s)) return 'cosmos';
  if (isNearAddress(s)) return 'near';
  if (isPolkadotAddress(s)) return 'polkadot';
  if (isSolanaAddress(s)) return 'solana';
  return 'unknown';
}

export function selfCheckAddressDetect() {
  console.assert(isEvmAddress('0xA8cC68942112c97d47c529354A8Ae40cF49523Ff'), 'evm');
  console.assert(isSolanaAddress('DHSWRUWsYoDEMMjUajDGLgbkCEsf16k5rDCRt8QPZv7k'), 'solana');
  console.assert(isCardanoAddress('addr1qxy2kgdyjrsq8q8qy0xy2kgdyjrsq8q8qy0xy2kgdyjrsq8q8qyfsaac'), 'cardano');
  console.assert(isCosmosAddress('cosmos1huydeevpz37sd9sn5ulv3xjt5wghxfu6w645lh0'), 'cosmos shape');
  console.assert(isNearAddress('build.near'), 'near named');
  console.assert(isPolkadotAddress('16YmFno7nQXLiGTbZ9AAr6RZ59zQCT9TPNkLWFUD3mZs57Fm'), 'dot shape');
  console.assert(detectAddressType('DHSWRUWsYoDEMMjUajDGLgbkCEsf16k5rDCRt8QPZv7k') === 'solana', 'route solana');
  return 'ok';
}
