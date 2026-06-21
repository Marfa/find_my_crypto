/** ponytail: resolve staking dashboard from token fields + CoinGecko; no per-contract hardcode */

const COINBASE_ETH_STAKING = 'https://www.coinbase.com/earn/staking/ethereum';

const EXPLORERS = {
  eth: 'https://eth.blockscout.com',
  base: 'https://base.blockscout.com',
  optimism: 'https://optimism.blockscout.com',
  arbitrum: 'https://arbitrum.blockscout.com',
  polygon: 'https://polygon.blockscout.com',
  gnosis: 'https://gnosis.blockscout.com',
  solana: 'https://solscan.io',
};

const CG_PLATFORM = {
  eth: 'ethereum',
  base: 'base',
  optimism: 'optimism',
  arbitrum: 'arbitrum',
  polygon: 'polygon-pos',
  gnosis: 'xdai',
  solana: 'solana',
};

/** Top 10 stakable assets — name/symbol patterns (not contract addresses) */
export const TOP_STAKING = [
  { asset: 'ETH', match: /lceth|lc staked|coinbase pooled/i, url: COINBASE_ETH_STAKING, operator: 'Coinbase Cloud (Kiln pooled staking)' },
  { asset: 'ETH', match: /wsteth|wrapped staked ether/i, url: 'https://stake.lido.fi/wrap', operator: 'Lido node operators (distributed set)' },
  { asset: 'ETH', match: /steth|staked ether|lido staked/i, url: 'https://stake.lido.fi/', operator: 'Lido node operators (distributed set)' },
  { asset: 'ETH', match: /reth|rocket pool/i, url: 'https://stake.rocketpool.net/', operator: 'Rocket Pool node operators' },
  { asset: 'ETH', match: /cbeth|coinbase wrapped staked/i, url: COINBASE_ETH_STAKING, operator: 'Coinbase validators' },
  { asset: 'ETH', match: /lseth|liquid collective|liquid staked eth/i, url: 'https://liquidcollective.io/why-stake/', operator: 'Liquid Collective node operators' },
  { asset: 'ETH', match: /sfrxeth|frax ether|frax staked/i, url: 'https://app.frax.finance/frxeth/mint', operator: 'Frax validators' },
  { asset: 'ETH', match: /sweth|swell/i, url: 'https://app.swellnetwork.io/', operator: 'Swell node operators' },
  { asset: 'ETH', match: /ethx|stader/i, url: 'https://www.staderlabs.com/eth/stake/', operator: 'Stader node operators' },
  { asset: 'ETH', match: /ankreth|ankr staked ether/i, url: 'https://www.ankr.com/staking/stake/', operator: 'Ankr validators' },
  { asset: 'ETH', match: /meth|mantle staked/i, url: 'https://www.meth.mantle.xyz/', operator: 'Mantle validators' },
  { asset: 'ETH', match: /oseth|stakewise staked/i, url: 'https://app.stakewise.io/', operator: 'StakeWise node operators' },
  { asset: 'ETH', match: /weeth|ether\.?fi|wrapped eeth/i, url: 'https://app.ether.fi/eeth', operator: 'Ether.fi node operators' },
  { asset: 'ETH', match: /ezeth|renzo/i, url: 'https://app.renzoprotocol.com/restake', operator: 'Renzo restaking operators' },
  { asset: 'ETH', match: /rseth|kelp|kernel staked/i, url: 'https://kerneldao.com/restake', operator: 'Kelp DAO node operators' },
  { asset: 'SOL', match: /msol|marinade staked/i, url: 'https://marinade.finance/app/stake/', operator: 'Marinade validators (Solana)' },
  { asset: 'SOL', match: /jitosol|jito staked/i, url: 'https://jito.network/', operator: 'Jito validators (Solana)' },
  { asset: 'SOL', match: /bsol|blazestake|stsol|liquid staked sol/i, url: 'https://marinade.finance/app/stake/', operator: 'Solana liquid staking' },
  { asset: 'ADA', match: /stada|staked ada|liquid ada/i, url: 'https://cardano.org/stake-pool-delegation/', operator: 'Cardano stake pools' },
  { asset: 'BNB', match: /stkbnb|bnbs|ankrbnb|staked bnb|liquid staked bnb/i, url: 'https://www.bnbchain.org/en/staking', operator: 'BNB Chain validators' },
  { asset: 'AVAX', match: /savax|staked avax|benqi staked/i, url: 'https://liquid.staking.avax.network/', operator: 'Avalanche validators' },
  { asset: 'DOT', match: /stdot|staked dot|liquid staked dot|ldot/i, url: 'https://staking.polkadot.network/', operator: 'Polkadot validators' },
  { asset: 'POL', match: /stmatic|maticx|stpol|polygon staked|liquid staking matic/i, url: 'https://staking.polygon.technology/', operator: 'Polygon validators' },
  { asset: 'ATOM', match: /statom|stkatom|staked atom|qatom|liquid staked atom/i, url: 'https://www.mintscan.io/cosmos/staking', operator: 'Cosmos validators' },
  { asset: 'NEAR', match: /stnear|linear staked near|near staked/i, url: 'https://wallet.near.org/staking', operator: 'NEAR validators' },
  { asset: 'GNO', match: /sgno|osgno|staked gno|gnosis staked/i, url: 'https://gnosis.io/staking', operator: 'Gnosis validators' },
];

/** Map project homepage → user staking app (generic rules, not token addresses) */
const HOMEPAGE_TO_STAKING = [
  { re: /lido\.fi/i, url: 'https://stake.lido.fi/' },
  { re: /rocketpool\.net/i, url: 'https://stake.rocketpool.net/' },
  { re: /coinbase\.com/i, url: COINBASE_ETH_STAKING },
  { re: /liquidcollective\.io/i, url: 'https://liquidcollective.io/why-stake/' },
  { re: /frax\.finance/i, url: 'https://app.frax.finance/frxeth/mint' },
  { re: /swellnetwork\.io/i, url: 'https://app.swellnetwork.io/' },
  { re: /staderlabs\.com/i, url: 'https://www.staderlabs.com/eth/stake/' },
  { re: /ankr\.com/i, url: 'https://www.ankr.com/staking/stake/' },
  { re: /ether\.fi/i, url: 'https://app.ether.fi/eeth' },
  { re: /renzoprotocol\.com/i, url: 'https://app.renzoprotocol.com/restake' },
  { re: /kelp\.dao|kerneldao\.com/i, url: 'https://kerneldao.com/restake' },
  { re: /mantle\.xyz|meth\.mantle/i, url: 'https://www.meth.mantle.xyz/' },
  { re: /stakewise\.io/i, url: 'https://app.stakewise.io/' },
  { re: /polygon\.technology|polygon\.technology/i, url: 'https://staking.polygon.technology/' },
  { re: /gnosis\.io/i, url: 'https://gnosis.io/staking' },
  { re: /avax\.network|benqi\.fi/i, url: 'https://liquid.staking.avax.network/' },
  { re: /marinade\.finance/i, url: 'https://marinade.finance/app/stake/' },
  { re: /jito\.network/i, url: 'https://jito.network/' },
];

const cgCache = new Map();

function tokenHaystack(token) {
  return `${token.name || ''} ${token.symbol || ''}`.toLowerCase();
}

export function isNativeSolStake(row) {
  return row?.chainId === 'solana' && row?.protocol === 'Native stake';
}

export function isStakingAssetToken(token) {
  const hay = tokenHaystack(token);
  return TOP_STAKING.some((p) => p.match.test(hay));
}

function chainExplorer(chainId) {
  return EXPLORERS[chainId];
}

function homepageToStakingUrl(homepage, token) {
  const sym = (token.symbol || '').toLowerCase();
  if (/wsteth/i.test(sym) || /wrapped staked ether/i.test(token.name || '')) {
    return 'https://stake.lido.fi/wrap';
  }
  for (const { re, url } of HOMEPAGE_TO_STAKING) {
    if (re.test(homepage)) return url;
  }
  return homepage.replace(/\/$/, '');
}

/** Infer operator + staking URL from Blockscout token name/symbol */
export function inferFromToken(token) {
  const hay = tokenHaystack(token);
  for (const p of TOP_STAKING) {
    if (p.match.test(hay)) return { validatorUrl: p.url, operator: p.operator };
  }
  return null;
}

async function fetchCoinGeckoMeta(chainId, contract, signal) {
  if (!contract) return null;
  const key = `${chainId}:${contract.toLowerCase()}`;
  if (cgCache.has(key)) return cgCache.get(key);

  const platform = CG_PLATFORM[chainId];
  if (!platform || chainId === 'solana') {
    cgCache.set(key, null);
    return null;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contract}`,
      { signal },
    );
    if (!res.ok) {
      cgCache.set(key, null);
      return null;
    }
    const data = await res.json();
    const home = (data.links?.homepage || []).find((u) => u?.startsWith('http'));
    const token = { symbol: data.symbol, name: data.name };
    const meta = home
      ? { validatorUrl: homepageToStakingUrl(home, token), operator: data.name }
      : null;
    cgCache.set(key, meta);
    return meta;
  } catch {
    cgCache.set(key, null);
    return null;
  }
}

export async function resolveStakingMeta(token, chainId, signal) {
  const inferred = inferFromToken(token);
  const cg = await fetchCoinGeckoMeta(chainId, token.address_hash, signal);
  const base = chainExplorer(chainId);
  const validatorUrl = inferred?.validatorUrl || cg?.validatorUrl || null;
  const operator = inferred?.operator || cg?.operator || null;

  return {
    operator: validatorUrl ? operator : null,
    protocol: token.name || token.symbol || 'Staking',
    explorer: base && token.address_hash ? `${base}/token/${token.address_hash}` : null,
    validatorUrl,
  };
}

export async function enrichStakingRows(rows, signal) {
  const staking = rows.filter((r) => r.kind === 'staking');
  await Promise.all(
    staking.map(async (row) => {
      if (isNativeSolStake(row)) return;
      const inferred = inferFromToken({ symbol: row.symbol, name: row.name });
      if (inferred?.validatorUrl) {
        row.validatorUrl = row.validatorUrl ?? inferred.validatorUrl;
        row.validator = row.validator ?? inferred.operator;
      }
      const meta = await resolveStakingMeta(
        { symbol: row.symbol, name: row.name, address_hash: row.contract },
        row.chainId,
        signal,
      );
      row.validator = meta.operator ?? row.validator;
      row.protocol = meta.protocol ?? row.protocol;
      row.stakingUrl = meta.explorer ?? row.stakingUrl;
      row.validatorUrl = meta.validatorUrl ?? row.validatorUrl;
    }),
  );
}

/** ponytail: runnable self-check */
export function selfCheckStakingResolve() {
  const lc = inferFromToken({ symbol: 'lcETH', name: 'LC Staked Shared ETH' });
  console.assert(lc?.validatorUrl === COINBASE_ETH_STAKING, 'lcETH from token name');
  const st = inferFromToken({ symbol: 'STETH', name: 'Lido Staked Ether' });
  console.assert(st?.validatorUrl === 'https://stake.lido.fi/', 'stETH from token name');
  console.assert(isStakingAssetToken({ symbol: 'stMATIC', name: 'Staked MATIC' }), 'POL staking token');
  console.assert(isStakingAssetToken({ symbol: 'mSOL', name: 'Marinade staked SOL' }), 'SOL staking token');
  console.assert(!isStakingAssetToken({ symbol: 'BLOSK', name: 'BLOSK.io' }), 'BLOSK not liquid stake');
  console.assert(
    homepageToStakingUrl('https://rocketpool.net/', { symbol: 'reth' }) === 'https://stake.rocketpool.net/',
    'homepage transform',
  );
  return 'ok';
}
