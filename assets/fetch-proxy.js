/** ponytail: API proxy base — localhost, optional meta, or direct upstream */

/** @returns {string|null} Origin of Ruby/Render API proxy, or null → direct upstream */
export function proxyBase() {
  const meta = document.querySelector('meta[name="fmc-api-base"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/, '');
  if (typeof location !== 'undefined' && /^https?:/.test(location.protocol)) {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return location.origin;
  }
  return null;
}

const CG_IDS = {
  ada: 'cardano',
  atom: 'cosmos',
  near: 'near',
  dot: 'polkadot',
  bnb: 'binancecoin',
  avax: 'avalanche-2',
  sol: 'solana',
};

export async function fetchCgPrices(ids, signal) {
  const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
  if (!list.length) return {};
  const q = encodeURIComponent(list.join(','));
  const direct = `https://api.coingecko.com/api/v3/simple/price?ids=${q}&vs_currencies=usd`;
  const base = proxyBase();
  const urls = base
    ? [`${base}/api/coingecko/api/v3/simple/price?ids=${q}&vs_currencies=usd`, direct]
    : [direct];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* next */
    }
  }
  return {};
}

export async function nativePrice(key, signal) {
  const id = CG_IDS[key];
  if (!id) return null;
  const data = await fetchCgPrices(id, signal);
  return data[id]?.usd ?? null;
}

export function cosmosUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = proxyBase();
  if (base) return `${base}/api/cosmos${p}`;
  return `https://rest.cosmos.directory/cosmoshub${p}`;
}

export function polkadotUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = proxyBase();
  if (base) return `${base}/api/polkadot${p}`;
  return `https://polkadot-public-sidecar.parity-chains.parity.io${p}`;
}

export function polkadotRpcUrl() {
  const base = proxyBase();
  if (base) return `${base}/api/polkadot-rpc`;
  return 'https://polkadot-rpc.publicnode.com';
}

export function nearRpcUrl() {
  const base = proxyBase();
  if (base) return `${base}/api/near-rpc`;
  return 'https://rpc.mainnet.near.org';
}

export function evmRpcUrl(chainId) {
  const base = proxyBase();
  if (base) return `${base}/api/evm-rpc?chain=${encodeURIComponent(chainId)}`;
  if (chainId === 'bsc') return 'https://bsc.publicnode.com';
  if (chainId === 'avax') return 'https://avalanche-c-chain.publicnode.com';
  return null;
}

export function koiosUrl(path) {
  const suffix = path.startsWith('/api') ? path.slice(4) : path;
  const p = suffix.startsWith('/') ? suffix : `/${suffix}`;
  const base = proxyBase();
  if (base) return `${base}/api/koios${p}`;
  return `https://api.koios.rest/api${p}`;
}

export function solanaRpcUrl() {
  const base = proxyBase();
  if (base) return `${base}/api/solana-rpc`;
  return 'https://api.mainnet-beta.solana.com';
}

export function solanaStakeUrl(address) {
  const base = proxyBase();
  if (!base) return null;
  return `${base}/api/solana-stake?address=${encodeURIComponent(address)}`;
}

export async function fetchJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}
