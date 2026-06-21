/** Top 10 stakable assets — footer line + placeholder */

export const TOP10_SYMBOLS = ['ETH', 'SOL', 'ADA', 'BNB', 'AVAX', 'DOT', 'POL', 'ATOM', 'NEAR', 'GNO'];

export const ADDRESS_EXAMPLE = '0xA8cC68942112c97d47c529354A8Ae40cF49523Ff';

export function addressPlaceholder() {
  return ADDRESS_EXAMPLE;
}

export function supportedCoinsHtml(lang) {
  const l = lang === 'ru' ? 'ru' : 'en';
  const title = l === 'ru' ? 'Поддерживаемые монеты:' : 'Supported coins:';
  return `<p class="supported-line">${title} ${TOP10_SYMBOLS.join(' · ')}</p>`;
}
