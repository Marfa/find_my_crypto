/** ponytail: Cardano, Cosmos, NEAR, Polkadot lookups via public APIs */
import { enrichStakingRows } from './staking-resolve.js';
import { stakeAddressFromBase } from './cardano-address.js';
import {
  cosmosUrl, evmRpcUrl, fetchJson, koiosUrl, nativePrice, nearRpcUrl,
} from './fetch-proxy.js';
import { queryPolkadotAccount } from './polkadot-rpc.js';

async function koiosPost(path, body, signal) {
  const res = await fetch(koiosUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`koios_http_${res.status}`);
  return res.json();
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

function finish(rows, address, chainId, price, sourcesUsed) {
  return {
    rows,
    hasStaking: rows.some((r) => r.kind === 'staking'),
    chainsHit: rows.length ? [rows[0].chain] : [],
    address,
    ethRates: { [chainId]: price },
    sourcesUsed,
  };
}

export async function lookupCardanoAddress(address, { signal } = {}) {
  const addr = String(address).trim();
  const price = await nativePrice('ada', signal);
  const rows = [];
  let stakeAddr = addr.startsWith('stake1') ? addr : null;

  if (addr.startsWith('addr1')) {
    const list = await koiosPost('/v1/address_info', { _addresses: [addr] }, signal).catch(() => []);
    const info = Array.isArray(list) ? list[0] : null;

    if (info?.balance) {
      const amountNum = Number(info.balance) / 1e6;
      if (amountNum > 0) {
        rows.push({
          chain: 'Cardano',
          chainId: 'cardano',
          kind: 'wallet',
          symbol: 'ADA',
          name: 'Cardano',
          amount: String(amountNum),
          amountNum,
          usd: price != null ? amountNum * price : null,
          usdEstimated: false,
          icon: null,
          validator: null,
          protocol: null,
          stakingUrl: null,
          validatorUrl: null,
        });
      }
    }
    stakeAddr = info?.stake_address || stakeAddressFromBase(addr) || stakeAddr;
  }
  if (stakeAddr) {
    const accounts = await koiosPost('/v1/account_info', { _stake_addresses: [stakeAddr] }, signal);
    const acct = accounts?.[0];
    const totalLovelace = BigInt(acct?.total_balance || acct?.delegated_balance || 0);
    const staked = Number(totalLovelace) / 1e6;
    if (staked > 0 || acct?.delegated_pool) {
      const pool = acct?.delegated_pool || null;
      let poolTicker = acct?.delegated_pool_ticker || null;
      if (pool && !poolTicker) {
        try {
          const pools = await koiosPost('/v1/pool_info', { _pool_bech32_ids: [pool] }, signal);
          poolTicker = pools?.[0]?.meta_json?.ticker || poolTicker;
        } catch {
          /* optional pool meta */
        }
      }
      rows.push({
        chain: 'Cardano',
        chainId: 'cardano',
        kind: 'staking',
        symbol: 'ADA',
        name: 'Staked ADA',
        amount: String(staked || 0),
        amountNum: staked || 0,
        usd: price != null && staked ? staked * price : null,
        usdEstimated: false,
        icon: null,
        contract: pool,
        validator: poolTicker || pool || null,
        protocol: 'Cardano stake pool',
        stakingUrl: pool ? `https://pool.pm/${pool}` : null,
        validatorUrl: pool ? `https://cardanoscan.io/pool/${pool}` : 'https://cardano.org/stake-pool-delegation/',
      });
    }
  }

  await enrichStakingRows(rows, signal);
  rows.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  const sourcesUsed = ['koios'];
  if (price != null) sourcesUsed.push('coingecko');
  return finish(rows, addr, 'cardano', price, sourcesUsed);
}

export async function lookupCosmosAddress(address, { signal } = {}) {
  const addr = String(address).trim();
  const price = await nativePrice('atom', signal);
  const rows = [];

  try {
    const bal = await fetchJson(cosmosUrl(`/cosmos/bank/v1beta1/balances/${encodeURIComponent(addr)}`), signal);
    for (const b of bal.balances || []) {
      if (b.denom !== 'uatom') continue;
      const amountNum = Number(b.amount) / 1e6;
      if (amountNum <= 0) continue;
      rows.push({
        chain: 'Cosmos Hub',
        chainId: 'cosmos',
        kind: 'wallet',
        symbol: 'ATOM',
        name: 'Cosmos',
        amount: String(amountNum),
        amountNum,
        usd: price != null ? amountNum * price : null,
        usdEstimated: false,
        icon: null,
        validator: null,
        protocol: null,
        stakingUrl: null,
        validatorUrl: null,
      });
    }
  } catch {
    /* wallet balance optional */
  }

  try {
    const del = await fetchJson(cosmosUrl(`/cosmos/staking/v1beta1/delegations/${encodeURIComponent(addr)}`), signal);
    for (const d of del.delegation_responses || []) {
      const amountNum = Number(d.balance?.amount || 0) / 1e6;
      if (amountNum <= 0) continue;
      const val = d.delegation?.validator_address;
      rows.push({
        chain: 'Cosmos Hub',
        chainId: 'cosmos',
        kind: 'staking',
        symbol: 'ATOM',
        name: 'Staked ATOM',
        amount: String(amountNum),
        amountNum,
        usd: price != null ? amountNum * price : null,
        usdEstimated: false,
        icon: null,
        contract: val,
        validator: val,
        protocol: 'Cosmos validator',
        stakingUrl: val ? `https://www.mintscan.io/cosmos/validators/${val}` : null,
        validatorUrl: val ? `https://www.mintscan.io/cosmos/validators/${val}` : 'https://www.mintscan.io/cosmos/staking',
      });
    }
  } catch {
    /* delegations optional */
  }

  await enrichStakingRows(rows, signal);
  rows.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  const sourcesUsed = ['cosmosRest'];
  if (price != null) sourcesUsed.push('coingecko');
  return finish(rows, addr, 'cosmos', price, sourcesUsed);
}

async function nearRpc(method, params, signal) {
  const res = await fetch(nearRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal,
  });
  if (!res.ok) throw new Error(`near_http_${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'near_rpc_failed');
  return data.result;
}

export async function lookupNearAddress(address, { signal } = {}) {
  const accountId = String(address).trim().toLowerCase();
  const price = await nativePrice('near', signal);
  const rows = [];

  try {
    const acct = await nearRpc('query', {
      request_type: 'view_account',
      account_id: accountId,
      finality: 'final',
    }, signal);

    const amountNum = Number(acct.amount || '0') / 1e24;
    const lockedNum = Number(acct.locked || '0') / 1e24;

    if (amountNum > 0) {
      rows.push({
        chain: 'NEAR',
        chainId: 'near',
        kind: 'wallet',
        symbol: 'NEAR',
        name: 'NEAR',
        amount: String(amountNum),
        amountNum,
        usd: price != null ? amountNum * price : null,
        usdEstimated: false,
        icon: null,
        validator: null,
        protocol: null,
        stakingUrl: null,
        validatorUrl: null,
      });
    }

    if (lockedNum > 0) {
      rows.push({
        chain: 'NEAR',
        chainId: 'near',
        kind: 'staking',
        symbol: 'NEAR',
        name: 'Locked / staked NEAR',
        amount: String(lockedNum),
        amountNum: lockedNum,
        usd: price != null ? lockedNum * price : null,
        usdEstimated: false,
        icon: null,
        validator: null,
        protocol: 'NEAR staking',
        stakingUrl: `https://nearblocks.io/address/${accountId}`,
        validatorUrl: 'https://wallet.near.org/staking',
      });
    }
  } catch {
    /* account missing or rpc down */
  }

  await enrichStakingRows(rows, signal);
  rows.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  const sourcesUsed = ['nearRpc'];
  if (price != null) sourcesUsed.push('coingecko');
  return finish(rows, accountId, 'near', price, sourcesUsed);
}

export async function lookupPolkadotAddress(address, { signal } = {}) {
  const addr = String(address).trim();
  const price = await nativePrice('dot', signal);
  const rows = [];

  try {
    const info = await queryPolkadotAccount(addr, signal);
    if (info.freeDot != null && info.freeDot > 0) {
      rows.push({
        chain: 'Polkadot',
        chainId: 'polkadot',
        kind: 'wallet',
        symbol: 'DOT',
        name: 'Polkadot',
        amount: planckStr(info.freeDot),
        amountNum: info.freeDot,
        usd: price != null ? info.freeDot * price : null,
        usdEstimated: false,
        icon: null,
        validator: null,
        protocol: null,
        stakingUrl: null,
        validatorUrl: null,
      });
    }
    if (info.stakedDot != null && info.stakedDot > 0) {
      const validator = info.validator;
      rows.push({
        chain: 'Polkadot',
        chainId: 'polkadot',
        kind: 'staking',
        symbol: 'DOT',
        name: 'Staked DOT',
        amount: planckStr(info.stakedDot),
        amountNum: info.stakedDot,
        usd: price != null ? info.stakedDot * price : null,
        usdEstimated: false,
        icon: null,
        validator,
        protocol: 'Polkadot nomination',
        stakingUrl: `https://polkadot.subscan.io/account/${addr}`,
        validatorUrl: validator ? `https://polkadot.subscan.io/account/${validator}` : 'https://staking.polkadot.network/',
      });
    }
  } catch {
    /* RPC optional */
  }

  await enrichStakingRows(rows, signal);
  rows.sort((a, b) => (b.usd ?? -1) - (a.usd ?? -1));
  const sourcesUsed = ['polkadotRpc'];
  if (price != null) sourcesUsed.push('coingecko');
  return finish(rows, addr, 'polkadot', price, sourcesUsed);
}

function planckStr(n) {
  const s = String(n);
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

export function selfCheckNativeLookup() {
  console.assert(fromUnits('15000000000', 10) === '1.5', 'dot fromUnits');
  return 'ok';
}
