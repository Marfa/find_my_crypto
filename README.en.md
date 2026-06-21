# Find My Crypto

**Find My Crypto** is a static site to quickly find **staked coins** and show **validator** info for a wallet address.

No build step, no npm — [ponytail](https://github.com/DietrichGebert/ponytail) style. Code prepared with [Cursor](https://cursor.com).

**License:** [CC BY-NC-SA 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Russian (main): [README.ru.md](README.ru.md)

## Features

- **EVM** (`0x…`), **Solana**, **Cardano**, **Cosmos**, **NEAR**, **Polkadot**
- Table: token, amount, USD, **Validator** column (for staking — label + link)
- Multiple delegations to the same validator are **merged into one row**
- Light / dark ICO-style crypto theme, **RU / EN**
- Top-10 supported assets in the footer

### Networks

| Network | Source |
|---------|--------|
| Ethereum, Base, Optimism, Arbitrum, Polygon, Gnosis | [Blockscout](https://www.blockscout.com/) |
| BNB, Avalanche C-Chain | public RPC |
| Solana | Jupiter + `/api/solana-stake` |
| Cardano | [Koios](https://api.koios.rest/) |
| Cosmos, NEAR, Polkadot | public REST/RPC |

Optimism API base URL: `https://explorer.optimism.io/api/v2` (legacy `optimism.blockscout.com` redirects with broken CORS).

## Run locally

```bash
cd findmycrypto
ruby serve
```

Open http://127.0.0.1:8080 — self-check at `/check.html`.

## GitHub Pages & CORS

Deploy `serve` to [Render](https://render.com) and set in `index.html`:

```html
<meta name="fmc-api-base" content="https://your-api.onrender.com" />
```

Free hosting options: Render, Fly.io, Railway, Oracle Cloud Free, Google Cloud Run.

## Feedback

[GitHub Issues](https://github.com/Marfa/find_my_crypto/issues)

## Limits

- Solana native stake resolved via transaction history.
- USD for unlisted staking receipt tokens is estimated from native coin price.
- Requires HTTP server (ES modules).
