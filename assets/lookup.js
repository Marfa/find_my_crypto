/* ponytail: Blockscout multichain scan; upgrade path = dedicated indexers per chain family (Solana, etc.) */
import { enrichStakingRows, isStakingAssetToken } from './staking-resolve.js';
import { lookupSolanaAddress } from './solana-lookup.js';
import {
  lookupCardanoAddress, lookupCosmosAddress, lookupNearAddress, lookupPolkadotAddress,
} from './native-lookup.js';
import {
  detectAddressType, isEvmAddress, normalizeAddress,
} from './address-detect.js';
import { evmRpcUrl, fetchCgPrices, fetchJson as proxyFetchJson } from './fetch-proxy.js';
import { mergeStakingRows } from './row-merge.js';

export { detectAddressType, isEvmAddress, normalizeAddress } from './address-detect.js';
export { isSolanaAddress } from './address-detect.js';

export const CHAINS = [
  { id: 'eth', name: 'Ethereum', api: 'https://eth.blockscout.com/api/v2', native: 'ETH', explorer: 'https://eth.blockscout.com' },
  { id: 'base', name: 'Base', api: 'https://base.blockscout.com/api/v2', native: 'ETH', explorer: 'https://base.blockscout.com' },
  { id: 'optimism', name: 'Optimism', api: 'https://explorer.optimism.io/api/v2', native: 'ETH', explorer: 'https://explorer.optimism.io' },
  { id: 'arbitrum', name: 'Arbitrum', api: 'https://arbitrum.blockscout.com/api/v2', native: 'ETH', explorer: 'https://arbitrum.blockscout.com' },
  { id: 'polygon', name: 'Polygon', api: 'https://polygon.blockscout.com/api/v2', native: 'POL', explorer: 'https://polygon.blockscout.com' },
  { id: 'gnosis', name: 'Gnosis', api: 'https://gnosis.blockscout.com/api/v2', native: 'xDAI', explorer: 'https://gnosis.blockscout.com' },
];

/** ponytail: BNB + AVAX native balance via public RPC (same 0x address as EVM) */
const RPC_CHAINS = [
  { id: 'bsc', name: 'BNB Smart Chain', rpc: 'https://bsc.publicnode.com', native: 'BNB' },
  { id: 'avax', name: 'Avalanche', rpc: 'https://avalanche-c-chain.publicnode.com', native: 'AVAX' },
];

export const BLOCKSCOUT_HOME = 'https://www.blockscout.com/';

const STAKING_NAME = /staked|liquid staked|staking|lc staked|receipt eth/i;
const NOT_STAKING = new Set(['weth', 'seth', 'beth']);

function isStakingToken(token) {
  const sym = (token.symbol || '').toLowerCase();
  if (NOT_STAKING.has(sym)) return false;
  if (isStakingAssetToken(token)) return true;
  if (STAKING_NAME.test(token.name || '')) return true;
  if (sym.endsWith('eth') && sym !== 'eth' && sym.length > 4) return true;
  return false;
}

function fromUnits(value, decimals) {
  const d = Number(decimals ?? 18);
  const n = BigInt(value || '0');
  const base = 10n ** BigInt(d);
  const whole = n / base;
  const frac = n % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(d, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

function estimateUsd(row, nativeRates) {
  if (row.usd != null) return row.usd;
  const sym = (row.symbol || '').toLowerCase();
  const nativeRate = nativeRates[row.chainId];
  if (!nativeRate) return null;
  if (row.kind === 'staking' || (sym.endsWith('eth') && sym !== 'eth' && sym.length > 4)) {
    return row.amountNum * nativeRate;
  }
  return null;
}

async function fetchJson(url, signal) {
  return proxyFetchJson(url, signal);
}

async function rpcBalance(chainId, address, signal) {
  const url = evmRpcUrl(chainId);
  if (!url) return 0n;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`rpc_${res.status}`);
  const data = await res.json();
  return BigInt(data.result || '0x0');
}

async function scanRpcChain(chain, address, usdRate, signal) {
  try {
    const wei = await rpcBalance(chain.id, address, signal);
    if (wei <= 0n) return [];
    const amount = fromUnits(wei.toString(), 18);
    const amountNum = Number(amount);
    return [{
      chain: chain.name,
      chainId: chain.id,
      kind: 'wallet',
      symbol: chain.native,
      name: chain.native,
      amount,
      amountNum,
      usd: usdRate != null ? amountNum * usdRate : null,
      icon: null,
      validator: null,
      protocol: null,
      stakingUrl: null,
      validatorUrl: null,
    }];
  } catch {
    return [];
  }
}

async function fetchExtraEvmPrices(signal) {
  const data = await fetchCgPrices(['binancecoin', 'avalanche-2'], signal);
  return { bsc: data.binancecoin?.usd, avax: data['avalanche-2']?.usd };
}

async function scanChain(chain, address, signal) {
  const rows = [];
  let ethUsdRate = null;

  try {
    const info = await fetchJson(`${chain.api}/addresses/${address}`, signal);
    ethUsdRate = info.exchange_rate ? Number(info.exchange_rate) : null;
    const nativeBal = BigInt(info.coin_balance || '0');
    if (nativeBal > 0n) {
      const amount = fromUnits(nativeBal.toString(), 18);
      rows.push({
        chain: chain.name,
        chainId: chain.id,
        kind: 'wallet',
        symbol: chain.native,
        name: chain.native,
        amount,
        amountNum: Number(amount),
        usd: ethUsdRate ? Number(amount) * ethUsdRate : null,
        icon: null,
        validator: null,
        protocol: null,
        stakingUrl: null,
        validatorUrl: null,
      });
    }
  } catch {
    /* empty chain */
  }

  try {
    const tokens = await fetchJson(`${chain.api}/addresses/${address}/token-balances`, signal);
    for (const item of tokens || []) {
      const token = item.token || {};
      const amount = fromUnits(item.value, token.decimals);
      const amountNum = Number(amount);
      if (!amountNum || amountNum === 0) continue;

      const rate = token.exchange_rate ? Number(token.exchange_rate) : null;
      const staking = isStakingToken(token);

      rows.push({
        chain: chain.name,
        chainId: chain.id,
        kind: staking ? 'staking' : 'wallet',
        symbol: token.symbol || '?',
        name: token.name || token.symbol || 'Token',
        amount,
        amountNum,
        usd: rate != null ? amountNum * rate : null,
        icon: token.icon_url || null,
        contract: token.address_hash,
        validator: null,
        protocol: null,
        stakingUrl: null,
        validatorUrl: null,
      });
    }
  } catch {
    /* no tokens */
  }

  return { rows, ethUsdRate };
}

/** @returns {{ rows: object[], hasStaking: boolean, chainsHit: string[] }} */
export async function lookupEvmAddress(address, { signal } = {}) {
  if (!isEvmAddress(address)) {
    throw new Error('invalid_address');
  }

  const addr = normalizeAddress(address);
  const extraPrices = await fetchExtraEvmPrices(signal);
  const sourcesUsed = ['blockscout'];
  if (extraPrices.bsc || extraPrices.avax) sourcesUsed.push('coingecko');
  const results = await Promise.all(CHAINS.map((c) => scanChain(c, addr, signal)));
  const rpcRows = await Promise.all(
    RPC_CHAINS.map(async (c) => {
      const rows = await scanRpcChain(c, addr, extraPrices[c.id], signal);
      if (rows.length) sourcesUsed.push(c.id === 'bsc' ? 'bscRpc' : 'avaxRpc');
      return rows;
    }),
  );

  const ethRates = Object.fromEntries(results.map((r, i) => [CHAINS[i].id, r.ethUsdRate]).filter(([, v]) => v));
  if (extraPrices.bsc) ethRates.bsc = extraPrices.bsc;
  if (extraPrices.avax) ethRates.avax = extraPrices.avax;

  const rows = [
    ...results.flatMap((r) => r.rows),
    ...rpcRows.flat(),
  ].map((row) => {
    const hadPrice = row.usd != null;
    const usd = estimateUsd(row, ethRates);
    return {
      ...row,
      usd,
      usdEstimated: !hadPrice && usd != null,
    };
  });

  await enrichStakingRows(rows, signal);

  const merged = mergeStakingRows(rows);
  merged.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));

  const chainsHit = [...new Set(merged.map((r) => r.chain))];
  const hasStaking = merged.some((r) => r.kind === 'staking');

  return { rows: merged, hasStaking, chainsHit, address: addr, ethRates, sourcesUsed };
}

export async function lookupWallet(address, opts = {}) {
  const type = detectAddressType(address);
  let data;
  if (type === 'evm') data = await lookupEvmAddress(address, opts);
  else if (type === 'solana') data = await lookupSolanaAddress(address, opts);
  else if (type === 'cardano') data = await lookupCardanoAddress(address, opts);
  else if (type === 'cosmos') data = await lookupCosmosAddress(address, opts);
  else if (type === 'near') data = await lookupNearAddress(address, opts);
  else if (type === 'polkadot') data = await lookupPolkadotAddress(address, opts);
  else throw new Error('invalid_address');

  if (type !== 'evm') {
    data.rows = mergeStakingRows(data.rows);
    data.rows.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
    data.chainsHit = [...new Set(data.rows.map((r) => r.chain))];
    data.hasStaking = data.rows.some((r) => r.kind === 'staking');
  }
  return data;
}

/** @deprecated alias */
export const lookupAddress = lookupWallet;

export function formatUsd(value, locale, estimated = false) {
  if (value == null || Number.isNaN(value)) return '—';
  const s = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value);
  return estimated ? `~${s}` : s;
}

export function formatAmount(value, locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n === 0) return '0';
  if (n < 0.000001) return n.toExponential(4);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(n);
}

export function sortRows(rows, col, dir) {
  const m = dir === 'asc' ? 1 : -1;
  const list = [...rows];
  list.sort((a, b) => {
    if (col === 'token') return m * `${a.symbol}${a.chain}`.localeCompare(`${b.symbol}${b.chain}`, undefined, { sensitivity: 'base' });
    if (col === 'amount') return m * (a.amountNum - b.amountNum);
    if (col === 'usd') return m * ((a.usd ?? -Infinity) - (b.usd ?? -Infinity));
    if (col === 'validator') {
      const va = (a.validator || '').toLowerCase();
      const vb = (b.validator || '').toLowerCase();
      return m * va.localeCompare(vb, undefined, { sensitivity: 'base' });
    }
    return 0;
  });
  return list;
}

/** ponytail: runnable self-check — open check.html */
export function selfCheck() {
  console.assert(isEvmAddress('0xA8cC68942112c97d47c529354A8Ae40cF49523Ff'), 'valid evm');
  console.assert(!isEvmAddress('0xbad'), 'invalid evm');
  console.assert(detectAddressType('DHSWRUWsYoDEMMjUajDGLgbkCEsf16k5rDCRt8QPZv7k') === 'solana', 'detect solana');
  console.assert(fromUnits('25000000000000000', 18) === '0.025', 'fromUnits frac');
  const row = { symbol: 'lcETH', amountNum: 1.883, usd: null, kind: 'staking', chainId: 'eth' };
  console.assert(estimateUsd(row, { eth: 1725 }) === 1.883 * 1725, 'lcETH usd estimate');
  console.assert(isStakingToken({ symbol: 'lcETH', name: 'LC Staked Shared ETH' }), 'staking detect');
  console.assert(!isStakingToken({ symbol: 'USDT', name: 'Tether' }), 'not staking');
  return 'ok';
}
