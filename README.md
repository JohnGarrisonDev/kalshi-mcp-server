# Kalshi MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [Kalshi](https://kalshi.com) prediction-market exchange. It gives AI assistants like Claude Desktop rich, structured access to Kalshi's public market data — and, optionally, to your portfolio and order management — through Kalshi's official [trade API v2](https://docs.kalshi.com).

## Features

- **24+ tools** covering exchange status, markets, orderbooks, candlesticks, trades, events, series, milestones, multivariate collections, portfolio, and trading
- **Works out of the box with zero credentials** — all market-data tools hit Kalshi's public endpoints
- **Safe by default** — order placement/cancellation tools are *not registered* unless you explicitly opt in with `KALSHI_ENABLE_TRADING=true`
- **Production and demo environments** — point at Kalshi's demo exchange for risk-free experimentation
- **Proper request signing** — RSA-PSS/SHA-256 signatures per Kalshi's API-key authentication scheme
- Minimal dependencies (`@modelcontextprotocol/sdk`, `zod`), plain Node.js `fetch`, no bundler

## Quick start (Claude Desktop)

Requires [Node.js 18+](https://nodejs.org).

```bash
git clone https://github.com/JohnGarrisonDev/kalshi-mcp-server.git
cd kalshi-mcp-server
npm install
npm run build
```

Then add the server to your Claude Desktop config file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kalshi": {
      "command": "node",
      "args": ["/absolute/path/to/kalshi-mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop and ask something like:

> *"What are the most actively traded open markets on Kalshi right now?"*
>
> *"Show me the orderbook for the Fed rate decision market."*
>
> *"Chart the last week of daily candlesticks for KXHIGHNY."*

No API key is needed for any of that — market data is public.

## Configuration

All configuration is via environment variables in the `env` block of your MCP config:

| Variable | Required | Description |
|---|---|---|
| `KALSHI_ENV` | No | `prod` (default) or `demo` |
| `KALSHI_API_KEY_ID` | For portfolio/trading | Your Kalshi API key ID |
| `KALSHI_PRIVATE_KEY_PATH` | For portfolio/trading | Path to your RSA private key PEM file |
| `KALSHI_PRIVATE_KEY` | Alternative to path | The PEM itself, inline (`\n` escapes allowed) |
| `KALSHI_ENABLE_TRADING` | For trading only | Set to `true` to register order create/cancel/amend/decrease tools |
| `KALSHI_BASE_URL` | No | Override the REST base URL entirely |

### Authenticated example

Generate an API key under **Profile → API Keys** on [kalshi.com](https://kalshi.com) (or [demo.kalshi.co](https://demo.kalshi.co) for the demo environment) and save the private key PEM it gives you — Kalshi never shows it again.

```json
{
  "mcpServers": {
    "kalshi": {
      "command": "node",
      "args": ["/absolute/path/to/kalshi-mcp-server/dist/index.js"],
      "env": {
        "KALSHI_ENV": "prod",
        "KALSHI_API_KEY_ID": "your-key-id",
        "KALSHI_PRIVATE_KEY_PATH": "C:\\secrets\\kalshi-private-key.pem"
      }
    }
  }
}
```

This unlocks the portfolio tools (balance, positions, fills, settlements, orders). To also allow the model to **place and manage orders with real money**, add:

```json
        "KALSHI_ENABLE_TRADING": "true"
```

> ⚠️ **Trading safety.** With trading enabled on `prod`, the model can spend real funds. Strongly consider starting with `KALSHI_ENV: "demo"` (with demo credentials — keys are not shared between environments), and always review tool-call approvals in your MCP client. Demo and production credentials are separate; demo keys only work against the demo API.

## Tools

### Exchange (public)

| Tool | Description |
|---|---|
| `kalshi_get_exchange_status` | Whether the exchange and trading are active |
| `kalshi_get_exchange_schedule` | Trading hours and maintenance windows |
| `kalshi_get_exchange_announcements` | Exchange-wide announcements |
| `kalshi_get_series_fee_changes` | Upcoming/past fee changes, optionally per series |

### Markets (public)

| Tool | Description |
|---|---|
| `kalshi_list_markets` | Filter markets by event, series, status, tickers, close-time window |
| `kalshi_get_market` | Full detail for one market (prices, volume, rules, expiration) |
| `kalshi_get_orderbook` | Live order book with per-price-level depth |
| `kalshi_get_market_candlesticks` | Historical OHLC candles (1 min / 1 hour / 1 day) |
| `kalshi_get_trades` | Executed trades, all markets or one ticker |

### Events, series & reference data (public)

| Tool | Description |
|---|---|
| `kalshi_list_events` | Browse events, optionally with nested markets |
| `kalshi_get_event` | One event by ticker |
| `kalshi_get_event_metadata` | Event imagery and settlement sources |
| `kalshi_list_series` | Series by category (Politics, Economics, Sports, …) |
| `kalshi_get_series` | One series by ticker |
| `kalshi_list_milestones` / `kalshi_get_milestone` | Real-world data checkpoints markets settle against |
| `kalshi_list_multivariate_collections` / `kalshi_get_multivariate_collection` | Parameterized combo-market families |

### Portfolio (requires API credentials)

| Tool | Description |
|---|---|
| `kalshi_get_balance` | Available balance and payout (cents) |
| `kalshi_get_positions` | Open/settled positions with PnL |
| `kalshi_get_fills` | Trade executions |
| `kalshi_get_settlements` | Settlement history |
| `kalshi_list_orders` / `kalshi_get_order` | Your orders, filterable by status |

### Trading (requires credentials **and** `KALSHI_ENABLE_TRADING=true`)

| Tool | Description |
|---|---|
| `kalshi_create_order` | Place limit or market orders (auto-generates idempotency keys) |
| `kalshi_cancel_order` | Cancel a resting order |
| `kalshi_amend_order` | Change a resting order's price/count |
| `kalshi_decrease_order` | Reduce a resting order's remaining count |

## Notes on Kalshi data

- **Prices are in cents** (1–99) representing implied probability; a contract settles at 100¢ (yes) or 0¢ (no). Some newer responses also include `_dollars`/`_fp` fixed-point string fields.
- **Ticker hierarchy:** a *series* (e.g. `KXHIGHNY`) contains *events* (e.g. `KXHIGHNY-25JUL03`) which contain *markets* (e.g. `KXHIGHNY-25JUL03-B85.5`).
- **Pagination:** list endpoints return a `cursor`; pass it back to fetch the next page. List tools default to small page sizes (25–50) to keep responses MCP-client friendly.
- **Compact vs. full responses:** `kalshi_list_markets`, `kalshi_list_events`, and `kalshi_list_series` return trimmed summaries by default (tickers, titles, prices, volume, timings). Pass `full_details: true` for raw API objects, or use the corresponding `kalshi_get_*` tool for one item's complete data.
- **Size guard:** any response that would exceed ~40 KB is automatically trimmed (largest array halved until it fits) and annotated with a `_truncation_note`, so oversized tool results never crash the MCP client.
- Public data endpoints are rate-limited by Kalshi; the client retries on HTTP 429 with backoff.

## Development

```bash
npm install
npm run build      # compile TypeScript to dist/
npm run watch      # recompile on change
```

The server speaks MCP over stdio. A quick manual test:

```bash
node dist/index.js
# then paste a JSON-RPC initialize request, or use the MCP Inspector:
npx @modelcontextprotocol/inspector node dist/index.js
```

Project layout:

```
src/
  index.ts          entry point, tool registration & gating
  config.ts         environment-variable configuration
  client.ts         Kalshi REST client + RSA-PSS request signing
  helpers.ts        tool-result / error wrapper
  tools/
    exchange.ts     exchange status, schedule, announcements, fees
    markets.ts      markets, orderbooks, candlesticks, trades
    events.ts       events, series, milestones, multivariate collections
    portfolio.ts    balance, positions, fills, settlements, orders (read)
    trading.ts      order create/cancel/amend/decrease (opt-in)
```

## Security

- Your private key never leaves your machine; it is only used to sign request headers locally.
- Keep the PEM file out of the repo (`.gitignore` already excludes `*.pem`/`*.key`).
- Trading tools are opt-in by design; without `KALSHI_ENABLE_TRADING=true` the model cannot place, amend, or cancel orders no matter what it is asked.

## Disclaimer

This is an unofficial, community-built integration and is not affiliated with or endorsed by Kalshi. Prediction-market trading involves financial risk. Nothing here is financial advice; use the trading tools at your own risk and review your MCP client's tool-approval settings before enabling them.

## License

[MIT](LICENSE)
