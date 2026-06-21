/** Data sources — show only those used in a lookup */

export const SOURCES = {
  blockscout: {
    en: '<a href="https://www.blockscout.com/" target="_blank" rel="noopener noreferrer">Blockscout</a> (EVM)',
    ru: '<a href="https://www.blockscout.com/" target="_blank" rel="noopener noreferrer">Blockscout</a> (EVM)',
  },
  bscRpc: { en: 'BSC public RPC', ru: 'BSC public RPC' },
  avaxRpc: { en: 'Avalanche public RPC', ru: 'Avalanche public RPC' },
  solanaRpc: { en: 'Solana public RPC', ru: 'Solana public RPC' },
  koios: {
    en: '<a href="https://api.koios.rest/" target="_blank" rel="noopener noreferrer">Koios</a> (Cardano)',
    ru: '<a href="https://api.koios.rest/" target="_blank" rel="noopener noreferrer">Koios</a> (Cardano)',
  },
  cosmosRest: { en: 'Cosmos Hub REST', ru: 'Cosmos Hub REST' },
  nearRpc: { en: 'NEAR RPC', ru: 'NEAR RPC' },
  polkadotSidecar: { en: 'Polkadot Sidecar', ru: 'Polkadot Sidecar' },
  polkadotRpc: { en: 'Polkadot RPC', ru: 'Polkadot RPC' },
  coingecko: {
    en: '<a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer">CoinGecko</a> (USD)',
    ru: '<a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer">CoinGecko</a> (USD)',
  },
  jupiter: {
    en: '<a href="https://jup.ag/" target="_blank" rel="noopener noreferrer">Jupiter</a> (Solana tokens &amp; SOL price)',
    ru: '<a href="https://jup.ag/" target="_blank" rel="noopener noreferrer">Jupiter</a> (токены Solana и курс SOL)',
  },
};

export function sourcesHtml(ids, lang) {
  const l = lang === 'ru' ? 'ru' : 'en';
  const uniq = [...new Set(ids)].filter((id) => SOURCES[id]);
  if (!uniq.length) return '';
  const title = l === 'ru' ? 'Источники данных:' : 'Data sources:';
  const list = uniq.map((id) => SOURCES[id][l]).join(' · ');
  return `<p class="sources-line">${title} ${list}</p>`;
}
