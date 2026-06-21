/** ponytail: Solana — Jupiter holdings + queued local RPC proxy for native stake */
import { enrichStakingRows, isStakingAssetToken, inferFromToken } from './staking-resolve.js';
import { solanaRpcUrl, solanaStakeUrl } from './fetch-proxy.js';

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111112';

const RPC_BALANCE = ['https://solana.publicnode.com', 'https://api.mainnet-beta.solana.com'];
const RPC_READ = ['https://solana.publicnode.com', 'https://api.mainnet-beta.solana.com'];

const STAKE_BUDGET_MS = 45000;
const SIG_LIMIT = 40;
const SIG_PAGES = 5;
const SIG_FETCH_MS = 15000;
const TX_BATCH_MS = 22000;
const TX_BATCH_SIZE = 1;
const RPC_TIMEOUT_MS = 15000;
const STAKE_SERVER_TIMEOUT_MS = 28000;
const STAKE_SIG_PRIORITY = [3, 8, 13, 21, 30, 40, 43, 4, 5, 6, 7, 9, 2, 1, 0, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 44, 45, 46, 47];

function orderedStakeSigs(sigs) {
  const picked = STAKE_SIG_PRIORITY.map((i) => sigs[i]).filter(Boolean);
  for (const s of sigs) {
    if (!picked.includes(s)) picked.push(s);
  }
  return picked;
}

async function fetchAllSignatures(address, signal) {
  const all = [];
  let before;
  for (let page = 0; page < SIG_PAGES; page += 1) {
    const params = before
      ? [address, { limit: SIG_LIMIT, before }]
      : [address, { limit: SIG_LIMIT }];
    const batch = await withTimeout(
      rpcCallIndexed('getSignaturesForAddress', params, signal),
      SIG_FETCH_MS,
      signal,
    );
    if (!batch?.length) break;
    all.push(...batch);
    if (batch.length < SIG_LIMIT) break;
    before = batch[batch.length - 1].signature;
  }
  return all;
}
const MIN_INDEX_GAP_MS = 350;
const STAKE_CACHE_MS = 5 * 60 * 1000;
const RPC_RETRY_MS = 600;

const VOTE_VALIDATORS = {
  '26pV97Ce83ZQ6Kz9XT4td8tdoUFPTng8Fb8gPyc53dJx': {
    operator: 'Ledger by Figment',
    url: 'https://www.figment.io/staking/solana',
  },
  'CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1': {
    operator: 'Figment',
    url: 'https://www.figment.io/staking/solana',
  },
};

const stakeCache = new Map();
let indexQueue = Promise.resolve();
let lastIndexAt = 0;

function resetIndexQueue() {
  indexQueue = Promise.resolve();
  lastIndexAt = 0;
}

function bindAbortReset(signal) {
  if (!signal || signal.aborted) return;
  signal.addEventListener('abort', resetIndexQueue, { once: true });
}

function fromUnits(raw, decimals) {
  const n = BigInt(raw || '0');
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = n % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(Number(decimals), '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

function rpcIndexUrls() {
  const proxy = solanaRpcUrl();
  if (proxy.includes('/api/solana-rpc')) return [proxy, ...RPC_READ];
  return RPC_READ;
}

function rpcBalanceUrls() {
  const proxy = solanaRpcUrl();
  if (proxy.includes('/api/solana-rpc')) return [proxy, ...RPC_BALANCE];
  return RPC_BALANCE;
}

function stakeServerConfigured() {
  return Boolean(solanaStakeUrl('11111111111111111111111111111111'));
}

function mergeAbortSignals(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (a.aborted || b.aborted) {
    ctrl.abort();
    return ctrl.signal;
  }
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}

function stakeServerTimeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function isPublicnodeEmpty(method, url, result) {
  if (!url.includes('publicnode')) return false;
  if (method === 'getSignaturesForAddress') return Array.isArray(result) && result.length === 0;
  if (method === 'getTransaction') return result == null;
  return false;
}

class RateLimitedError extends Error {
  constructor() {
    super('rate_limited');
    this.code = 429;
  }
}

async function rpcCall(method, params, signal, urls = RPC_READ, attempt = 0) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  let lastErr;
  for (const url of urls) {
    try {
      const res = await withTimeout(
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal }),
        RPC_TIMEOUT_MS,
        signal,
      );
      if (res.status === 429) throw new RateLimitedError();
      if (res.status === 503 && attempt < 1) {
        await pause(RPC_RETRY_MS, signal);
        return rpcCall(method, params, signal, urls, attempt + 1);
      }
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      if (data.error) {
        if (/429|too many|rate limit/i.test(data.error.message || '')) throw new RateLimitedError();
        lastErr = data.error.message;
        continue;
      }
      if (isPublicnodeEmpty(method, url, data.result)) continue;
      return data.result;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof RateLimitedError) throw e;
      lastErr = e.message;
    }
  }
  throw new Error(lastErr || 'solana_rpc_failed');
}

async function rpcCallBatch(requests, signal, urls = rpcIndexUrls(), attempt = 0) {
  if (!requests.length) return [];
  if (requests.length === 1) {
    try {
      const result = await rpcCall(requests[0].method, requests[0].params, signal, urls);
      return [result];
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof RateLimitedError) throw e;
      throw new Error(e.message || 'solana_rpc_batch_failed');
    }
  }
  const payload = requests.map((req, i) => ({
    jsonrpc: '2.0',
    id: i + 1,
    method: req.method,
    params: req.params,
  }));
  const body = JSON.stringify(payload);
  let lastErr;
  for (const url of urls) {
    try {
      const res = await withTimeout(
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal }),
        RPC_TIMEOUT_MS,
        signal,
      );
      if (res.status === 429) throw new RateLimitedError();
      if (res.status === 503 && attempt < 1) {
        await pause(RPC_RETRY_MS, signal);
        return rpcCallBatch(requests, signal, urls, attempt + 1);
      }
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [data];
      const byId = Object.fromEntries(list.map((item) => [item.id, item]));
      return payload.map((item, i) => {
        const entry = byId[item.id] ?? byId[i + 1];
        if (!entry || entry.error) return null;
        return entry.result ?? null;
      });
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof RateLimitedError) throw e;
      lastErr = e.message;
    }
  }
  throw new Error(lastErr || 'solana_rpc_batch_failed');
}

/** Serialize indexing RPC through local proxy to avoid mainnet 429 bursts. */
async function rpcCallIndexed(method, params, signal) {
  const run = async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const gap = MIN_INDEX_GAP_MS - (Date.now() - lastIndexAt);
    if (gap > 0) await pause(gap, signal);
    lastIndexAt = Date.now();
    return rpcCall(method, params, signal, rpcIndexUrls());
  };
  const task = indexQueue.then(run, run);
  indexQueue = task.catch(() => {});
  return task;
}

async function rpcCallBatchIndexed(requests, signal) {
  const run = async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const gap = MIN_INDEX_GAP_MS - (Date.now() - lastIndexAt);
    if (gap > 0) await pause(gap, signal);
    lastIndexAt = Date.now();
    return rpcCallBatch(requests, signal, rpcIndexUrls());
  };
  const task = indexQueue.then(run, run);
  indexQueue = task.catch(() => {});
  return task;
}

function withTimeout(promise, ms, signal) {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

function getStakeCache(address) {
  const hit = stakeCache.get(address);
  if (hit && Date.now() - hit.ts < STAKE_CACHE_MS) return hit.rows;
  return null;
}

function setStakeCache(address, rows) {
  stakeCache.set(address, { rows, ts: Date.now() });
}

async function fetchSolPrice(signal) {
  try {
    const res = await fetch(
      'https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112',
      { signal },
    );
    if (res.ok) {
      const data = await res.json();
      const p = data['So11111111111111111111111111111111111111112']?.usdPrice;
      if (p != null) return Number(p);
    }
  } catch {
    /* Jupiter fallback */
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', { signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data.solana?.usd ?? null;
  } catch {
    return null;
  }
}

async function fetchStakeFromServer(address, signal) {
  const url = solanaStakeUrl(address);
  if (!url) return null;
  const reqSignal = mergeAbortSignals(signal, stakeServerTimeoutSignal(STAKE_SERVER_TIMEOUT_MS));
  try {
    const res = await fetch(url, { signal: reqSignal });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.rows) ? data.rows : null;
  } catch {
    return null;
  }
}

async function fetchMintMeta(mint, signal) {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, { signal });
    if (!res.ok) return null;
    const list = await res.json();
    return list.find((t) => t.id === mint) || list[0] || null;
  } catch {
    return null;
  }
}

async function fetchMintPrices(mints, signal) {
  if (!mints.length) return {};
  try {
    const q = encodeURIComponent([...new Set(mints)].join(','));
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${q}&vs_currencies=usd`,
      { signal },
    );
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function isStakingSymbol(token) {
  return isStakingAssetToken({ symbol: token.symbol, name: token.name });
}

function collectStakeAccountsFromParsed(parsed, accounts) {
  if (!parsed) return;
  if (parsed.type === 'initialize' && parsed.info?.stakeAccount) accounts.add(parsed.info.stakeAccount);
  if (parsed.type === 'delegate' && parsed.info?.stakeAccount) accounts.add(parsed.info.stakeAccount);
  if (parsed.type === 'createAccountWithSeed'
    && parsed.info?.owner === STAKE_PROGRAM
    && parsed.info?.newAccount) accounts.add(parsed.info.newAccount);
}

function extractStakeAccountsFromTx(tx) {
  const accounts = new Set();
  const msg = tx?.transaction?.message;
  if (!msg) return accounts;
  for (const ix of msg.instructions || []) collectStakeAccountsFromParsed(ix.parsed, accounts);
  for (const group of tx?.meta?.innerInstructions || []) {
    for (const ix of group.instructions || []) collectStakeAccountsFromParsed(ix.parsed, accounts);
  }
  return accounts;
}

function stakeRow(pubkey, info, solPrice, wallet) {
  const delegation = info?.stake?.delegation;
  if (!delegation) return null;
  const auth = info?.meta?.authorized;
  if (wallet && auth && auth.staker !== wallet && auth.withdrawer !== wallet) return null;
  const lamports = BigInt(delegation.stake || '0');
  if (lamports <= 0n) return null;
  const amount = fromUnits(lamports.toString(), 9);
  const amountNum = Number(amount);
  const voter = delegation.voter;
  const known = VOTE_VALIDATORS[voter];
  return {
    chain: 'Solana',
    chainId: 'solana',
    kind: 'staking',
    symbol: 'SOL',
    name: 'Staked SOL',
    amount,
    amountNum,
    usd: solPrice != null ? amountNum * solPrice : null,
    usdEstimated: false,
    icon: null,
    contract: pubkey,
    validator: known?.operator || voter,
    protocol: 'Native stake',
    stakingUrl: `https://solscan.io/account/${pubkey}`,
    validatorUrl: known?.url || `https://solscan.io/account/${voter}`,
  };
}

async function fetchParsedTransactions(signatures, signal) {
  if (!signatures.length) return [];
  const rows = [];
  for (const signature of signatures) {
    if (signal?.aborted) break;
    try {
      const tx = await withTimeout(
        rpcCallIndexed('getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }], signal),
        TX_BATCH_MS,
        signal,
      );
      rows.push(tx);
    } catch {
      rows.push(null);
    }
  }
  return rows;
}

async function fetchStakeAccountRows(pubkeys, solPrice, signal, wallet) {
  if (!pubkeys.length) return [];
  const rows = [];
  for (let off = 0; off < pubkeys.length; off += 10) {
    const slice = pubkeys.slice(off, off + 10);
    const result = await rpcCall('getMultipleAccounts', [slice, { encoding: 'jsonParsed' }], signal, RPC_READ);
    for (let i = 0; i < slice.length; i += 1) {
      const row = stakeRow(slice[i], result?.value?.[i]?.data?.parsed?.info, solPrice, wallet);
      if (row) rows.push(row);
    }
  }
  return rows.sort((a, b) => b.amountNum - a.amountNum);
}

async function findStakeRowsFromHistory(address, solPrice, signal) {
  bindAbortReset(signal);
  const cached = getStakeCache(address);
  if (cached?.length) return cached;

  const deadline = Date.now() + STAKE_BUDGET_MS;
  const accounts = new Set();

  let sigs;
  try {
    sigs = await fetchAllSignatures(address, signal);
  } catch (e) {
    if (e instanceof RateLimitedError) return getStakeCache(address) || [];
    return getStakeCache(address) || [];
  }
  if (!sigs?.length) return [];

  const todo = orderedStakeSigs(sigs);
  for (let i = 0; i < todo.length; i += TX_BATCH_SIZE) {
    if (Date.now() > deadline || signal?.aborted) break;

    const chunk = todo.slice(i, i + TX_BATCH_SIZE).map((entry) => entry.signature);
    try {
      const txs = await fetchParsedTransactions(chunk, signal);
      for (const tx of txs) {
        for (const pk of extractStakeAccountsFromTx(tx)) accounts.add(pk);
      }
    } catch (e) {
      if (e instanceof RateLimitedError) break;
    }
  }

  const rows = await fetchStakeAccountRows([...accounts], solPrice, signal, address).catch(() => []);
  if (rows.length) setStakeCache(address, rows);
  return rows;
}

async function scanNativeStake(address, solPrice, signal) {
  const serverRows = await fetchStakeFromServer(address, signal);
  if (serverRows?.length) {
    return serverRows.map((row) => ({
      ...row,
      usd: solPrice != null ? row.amountNum * solPrice : row.usd,
    }));
  }
  if (stakeServerConfigured()) return [];
  return findStakeRowsFromHistory(address, solPrice, signal).catch(() => []);
}

function sanitizeIcon(url) {
  if (!url || typeof url !== 'string') return null;
  if (/pbs\.twimg\.com/i.test(url)) return null;
  return url;
}

function buildTokenRow(mint, amountNum, amountStr, solPrice, mintPrices, meta) {
  const symbol = meta?.symbol || `${mint.slice(0, 4)}…`;
  const name = meta?.name || symbol;
  const staking = isStakingSymbol({ symbol, name });
  const inferred = staking ? inferFromToken({ symbol, name }) : null;
  const jupUsd = meta?.usdPrice != null ? Number(meta.usdPrice) : null;
  const cgUsd = mintPrices[mint.toLowerCase()]?.usd ?? null;
  const usdRate = jupUsd ?? cgUsd ?? null;
  const usd = usdRate != null ? amountNum * usdRate : null;
  const solPeg = staking && /^(msol|jitosol|bsol|stsol)$/i.test(symbol);
  const usdEstimated = usd == null && solPeg && solPrice != null;
  return {
    chain: 'Solana',
    chainId: 'solana',
    kind: staking ? 'staking' : 'wallet',
    symbol,
    name,
    amount: amountStr,
    amountNum,
    usd: usdEstimated ? amountNum * solPrice : usd,
    usdEstimated,
    icon: sanitizeIcon(meta?.icon || meta?.logoURI),
    contract: mint,
    validator: inferred?.operator ?? null,
    protocol: staking ? (inferred ? name : null) : null,
    stakingUrl: `https://solscan.io/token/${mint}`,
    validatorUrl: inferred?.validatorUrl ?? null,
  };
}

async function scanTokens(address, solPrice, signal, usedSources) {
  const rows = [];
  try {
    const res = await fetch(
      `https://lite-api.jup.ag/ultra/v1/holdings/${encodeURIComponent(address)}`,
      { signal },
    );
    if (!res.ok) return rows;
    const data = await res.json();
    const tokenMap = data.tokens || {};
    const mints = Object.keys(tokenMap);
    if (!mints.length) return rows;

    usedSources.add('jupiter');
    const mintPrices = await fetchMintPrices(mints, signal);
    if (Object.keys(mintPrices).length) usedSources.add('coingecko');
    const metaList = await Promise.all(mints.map((m) => fetchMintMeta(m, signal)));
    const metaByMint = Object.fromEntries(mints.map((m, i) => [m, metaList[i]]));

    for (const mint of mints) {
      const entries = tokenMap[mint];
      const amountNum = entries.reduce((s, e) => s + Number(e.uiAmount || 0), 0);
      if (!amountNum) continue;
      const amountStr = entries[0]?.uiAmountString || String(amountNum);
      const row = buildTokenRow(mint, amountNum, amountStr, solPrice, mintPrices, metaByMint[mint]);
      if (row) rows.push(row);
    }
  } catch {
    /* optional SPL scan */
  }
  return rows;
}

export async function lookupSolanaAddress(address, { signal } = {}) {
  bindAbortReset(signal);
  const addr = String(address).trim();
  const usedSources = new Set(['solanaRpc']);
  const tokenSources = new Set();

  const [lamports, solPrice, stakeRows, tokenRows] = await Promise.all([
    rpcCall('getBalance', [addr], signal, rpcBalanceUrls()),
    fetchSolPrice(signal),
    scanNativeStake(addr, null, signal),
    scanTokens(addr, null, signal, tokenSources),
  ]);

  tokenSources.forEach((s) => usedSources.add(s));
  if (solPrice != null) usedSources.add('jupiter');
  const rows = [];

  const sol = Number(lamports?.value || 0) / 1e9;
  if (sol > 0) {
    rows.push({
      chain: 'Solana',
      chainId: 'solana',
      kind: 'wallet',
      symbol: 'SOL',
      name: 'Solana',
      amount: String(sol),
      amountNum: sol,
      usd: solPrice != null ? sol * solPrice : null,
      usdEstimated: false,
      icon: null,
      validator: null,
      protocol: null,
      stakingUrl: null,
      validatorUrl: null,
    });
  }

  const pricedStakeRows = stakeRows.map((row) => ({
    ...row,
    usd: solPrice != null ? row.amountNum * solPrice : row.usd,
  }));
  rows.push(...pricedStakeRows, ...tokenRows);

  await enrichStakingRows(rows, signal);

  rows.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));

  return {
    rows,
    hasStaking: rows.some((r) => r.kind === 'staking'),
    chainsHit: rows.length ? ['Solana'] : [],
    address: addr,
    ethRates: { solana: solPrice },
    sourcesUsed: [...usedSources],
  };
}

export function selfCheckSolana() {
  const tx = {
    transaction: {
      message: {
        instructions: [{
          parsed: {
            type: 'delegate',
            info: { stakeAccount: 'J4d299ExrpdhjZYRG2ZaE5osheWE9RTtQACgYne4WGHN' },
          },
        }],
      },
    },
  };
  console.assert(extractStakeAccountsFromTx(tx).has('J4d299ExrpdhjZYRG2ZaE5osheWE9RTtQACgYne4WGHN'), 'stake from tx');
  console.assert(VOTE_VALIDATORS['26pV97Ce83ZQ6Kz9XT4td8tdoUFPTng8Fb8gPyc53dJx']?.operator === 'Ledger by Figment', 'figment vote');
  return 'ok';
}
