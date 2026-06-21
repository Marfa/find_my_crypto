# Find My Crypto

**Сайт:** [https://marfa.github.io/find_my_crypto/](https://marfa.github.io/find_my_crypto/)

**Find My Crypto** — статический сайт для быстрого поиска **застейканных монет** и отображения **валидатора** по адресу кошелька.

Без сборки, без npm — [ponytail](https://github.com/DietrichGebert/ponytail)-стиль. Код подготовлен с помощью [Cursor](https://cursor.com).

**Лицензия:** [CC BY-NC-SA 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/) — некоммерческое использование с указанием авторства; производные работы на тех же условиях.

English: [README.en.md](README.en.md)

## Возможности

- Поиск по **EVM** (`0x…`), **Solana**, **Cardano** (`addr1` / `stake1`), **Cosmos**, **NEAR**, **Polkadot**
- Таблица: токен, сумма, USD, колонка **«Валидатор»** (для стейкинга — название + ссылка)
- Несколько делегаций к одному валидатору (например Solana) **объединяются в одну строку**
- Светлая / тёмная тема в стиле crypto/ICO landing, **RU / EN**
- Топ-10 монет в подвале: ETH, SOL, ADA, BNB, AVAX, DOT, POL, ATOM, NEAR, GNO

### Сети и источники

| Сеть | Источник |
|------|----------|
| Ethereum, Base, Optimism, Arbitrum, Polygon, Gnosis | [Blockscout](https://www.blockscout.com/) |
| BNB Chain, Avalanche C-Chain | публичный RPC |
| Solana (токены + native stake) | Jupiter, RPC + `/api/solana-stake` |
| Cardano | [Koios](https://api.koios.rest/) |
| Cosmos Hub | Cosmos REST |
| NEAR | NEAR RPC |
| Polkadot | Polkadot Sidecar |

Optimism API: `explorer.optimism.io` (старый `optimism.blockscout.com` отдаёт 301 без CORS).

USD: Blockscout, Jupiter, CoinGecko на момент запроса.

## Локально

```bash
cd findmycrypto
ruby serve
```

http://127.0.0.1:8080 · проверка: `/check.html` → `ok`

**Примеры**

- EVM: `0xf03b7a98808230eeb7cc035d953e56d46df93da5`
- Solana (7× stake): `DHSWRUWsYoDEMMjUajDGLgbkCEsf16k5rDCRt8QPZv7k`
- Cardano: `addr1q8909sa0jafrg0uqhc8dwgh0g7j78qt956frmclcmw4jpux9k4s36j4tlqp0nepjdgsgpas4uydh6g3upa7z45mg82eqgfmv4n`

## GitHub Pages и CORS

Без Ruby `serve` CORS блокирует Koios, Cosmos, NEAR, Polkadot, Solana stake. EVM (Blockscout) обычно работает.

Production:

- Сайт: [marfa.github.io/find_my_crypto](https://marfa.github.io/find_my_crypto/)
- Прокси: [find-my-crypto-api.onrender.com](https://find-my-crypto-api.onrender.com)

1. Разверните `serve` на [Render](https://render.com) (`render.yaml`).
2. В `index.html` укажите:

```html
<meta name="fmc-api-base" content="https://find-my-crypto-api.onrender.com" />
```

### Бесплатный хостинг прокси

| Платформа | Комментарий |
|-----------|-------------|
| [Render](https://render.com) | `render.yaml`, cold start на free |
| [Fly.io](https://fly.io) | быстрее, нужен fly.toml |
| [Railway](https://railway.app) | ограниченный free credit |
| [Oracle Cloud Free](https://www.oracle.com/cloud/free/) | VM без sleep |
| [Google Cloud Run](https://cloud.google.com/run) | контейнер |

## GitHub Pages

Settings → Pages → GitHub Actions → push в `main`.

## Обратная связь

[Issues](https://github.com/Marfa/find_my_crypto/issues) · донаты в подвале сайта.

## Структура

```
index.html
serve, render.yaml
assets/
  lookup.js, solana-lookup.js, native-lookup.js
  row-merge.js, staking-resolve.js
  fetch-proxy.js, app.js, i18n.js, style.css
```

## Ограничения

- Solana stake через историю tx, не `getProgramAccounts`.
- USD для receipt-токенов без листинга — оценка по курсу нативной монеты.
- ES modules требуют HTTP-сервера.
