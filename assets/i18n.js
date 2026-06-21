import { supportedCoinsHtml, addressPlaceholder } from './supported-coins.js';

const STR = {
  en: {
    site: 'Find My Crypto',
    tagline: 'Enter a wallet address to find staked coins and get validator data.',
    address: 'Wallet address',
    addressPh: '0x… or Solana address',
    search: 'Search',
    searching: 'Scanning chains…',
    token: 'Token',
    amount: 'Amount',
    usd: 'USD',
    chain: 'Chain',
    validatorUnknown: '—',
    validatorExchange: 'Validator',
    noResults: 'No balances found on supported networks.',
    invalidAddress: 'Unsupported address format. See supported coins list below.',
    error: 'Lookup failed. Try again in a moment.',
    total: 'Estimated total',
    networks: 'Networks with activity',
    theme: 'Theme',
    lang: 'Language',
    themeLight: 'Light theme (click again for auto)',
    themeDark: 'Dark theme (click again for auto)',
    back: 'Back',
    stakingTitle: 'Staking positions',
    stakingFor: 'Staking for',
    operator: 'Validator / operator',
    protocol: 'Protocol',
    noStaking: 'No staking positions found for this address.',
    hideSmall: 'Hide tokens below (incl. no USD rate)',
    usdShort: 'USD',
    reportIssue: 'Report an issue',
    footerNoteHtml:
      'USD rates: Blockscout / CoinGecko at lookup time. '
      + 'Staking tokens without a listed price use the native coin rate (~estimate).',
    footerLegalHtml:
      '© 2026 Find My Crypto · '
      + '<a href="https://github.com/Marfa/find_my_crypto" target="_blank" rel="noopener noreferrer">Source code</a> · '
      + '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> · '
      + '<a href="https://www.donationalerts.com/r/themarfa" target="_blank" rel="noopener noreferrer">Donate</a> · '
      + '<a href="https://nowpayments.io/donation/themarfa" target="_blank" rel="noopener noreferrer">Crypto donate</a>',
  },
  ru: {
    site: 'Find My Crypto',
    tagline: 'Введите адрес кошелька, чтобы найти монеты в стейкинге и получить данные о валидаторе.',
    address: 'Адрес кошелька',
    addressPh: '0x… или Solana-адрес',
    search: 'Найти',
    searching: 'Сканируем сети…',
    token: 'Токен',
    amount: 'Сумма',
    usd: 'USD',
    chain: 'Сеть',
    validatorUnknown: '—',
    validatorExchange: 'Валидатор',
    noResults: 'Балансы не найдены в поддерживаемых сетях.',
    invalidAddress: 'Формат адреса не поддерживается. См. список монет ниже.',
    error: 'Ошибка запроса. Попробуйте позже.',
    total: 'Примерная сумма',
    networks: 'Сети с активностью',
    theme: 'Тема',
    lang: 'Язык',
    themeLight: 'Светлая тема (ещё раз — авто)',
    themeDark: 'Тёмная тема (ещё раз — авто)',
    back: 'Назад',
    stakingTitle: 'Позиции в стейкинге',
    stakingFor: 'Стейкинг для',
    operator: 'Валидатор / оператор',
    protocol: 'Протокол',
    noStaking: 'Стейкинг для этого адреса не найден.',
    hideSmall: 'Скрыть токены ниже (и без курса USD)',
    usdShort: 'USD',
    reportIssue: 'Сообщить о проблеме',
    footerNoteHtml:
      'Курсы USD: Blockscout / CoinGecko на момент запроса. '
      + 'Стейкинг-токены без цены оцениваются по курсу монеты (~оценка).',
    footerLegalHtml:
      '© 2026 Find My Crypto · '
      + '<a href="https://github.com/Marfa/find_my_crypto" target="_blank" rel="noopener noreferrer">Исходный код</a> · '
      + '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a> · '
      + '<a href="https://www.donationalerts.com/r/themarfa" target="_blank" rel="noopener noreferrer">Донат</a> · '
      + '<a href="https://nowpayments.io/donation/themarfa" target="_blank" rel="noopener noreferrer">Донат криптой</a>',
  },
};

let lang = detectLang();

export function detectLang() {
  const saved = localStorage.getItem('fmc-lang');
  if (saved === 'en' || saved === 'ru') return saved;
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function setLang(code) {
  if (code === 'auto') {
    localStorage.removeItem('fmc-lang');
    lang = detectLang();
  } else {
    localStorage.setItem('fmc-lang', code);
    lang = code;
  }
  document.documentElement.lang = lang;
  apply();
  document.dispatchEvent(new Event('fmc:langchange'));
}

export function t(key) {
  return STR[lang][key] ?? STR.en[key] ?? key;
}

export function locale() {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

export function currentLang() {
  return lang;
}

export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = el.id === 'address' ? addressPlaceholder() : t(el.dataset.i18nPh);
  });
  root.querySelectorAll('[data-supported-coins]').forEach((el) => {
    el.innerHTML = supportedCoinsHtml(lang);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  const pageTitle = root.querySelector('[data-page-title]');
  document.title = pageTitle ? `${t(pageTitle.dataset.pageTitle)} — ${t('site')}` : t('site');
}

export function init() {
  document.documentElement.lang = lang;
  apply();
}
