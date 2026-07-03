import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KalshiClient } from "../client.js";
import { handle } from "../helpers.js";

const paginationNote = "Responses are paginated; pass the returned `cursor` back in to fetch the next page.";

export function registerMarketTools(server: McpServer, client: KalshiClient): void {
  server.registerTool(
    "kalshi_list_markets",
    {
      title: "List markets",
      description:
        "List Kalshi markets with optional filters (event, series, status, close-time window). " +
        "Prices are in cents (1-99). " +
        paginationNote,
      inputSchema: {
        limit: z.number().int().min(1).max(1000).optional().describe("Results per page (1-1000, default 100)"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        event_ticker: z.string().optional().describe("Filter to markets in this event"),
        series_ticker: z.string().optional().describe("Filter to markets in this series"),
        status: z
          .enum(["unopened", "open", "closed", "settled"])
          .optional()
          .describe("Filter by market status"),
        tickers: z.string().optional().describe("Comma-separated list of specific market tickers"),
        min_close_ts: z.number().int().optional().describe("Only markets closing at/after this Unix timestamp"),
        max_close_ts: z.number().int().optional().describe("Only markets closing at/before this Unix timestamp"),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/markets", { query: args })
    )
  );

  server.registerTool(
    "kalshi_get_market",
    {
      title: "Get market",
      description:
        "Get full details for a single Kalshi market by ticker: title, rules, yes/no bid/ask, last price, volume, open interest, expiration. Prices are in cents.",
      inputSchema: {
        ticker: z.string().describe("Market ticker, e.g. 'KXHIGHNY-25JUL03-B85.5'"),
      },
    },
    handle(async (args: { ticker: string }) =>
      client.request("GET", `/markets/${encodeURIComponent(args.ticker)}`)
    )
  );

  server.registerTool(
    "kalshi_get_orderbook",
    {
      title: "Get market orderbook",
      description:
        "Get the current order book (resting yes/no bids by price level) for a Kalshi market. Each level is [price_in_cents, contract_count].",
      inputSchema: {
        ticker: z.string().describe("Market ticker"),
        depth: z.number().int().min(1).max(100).optional().describe("Max price levels per side"),
      },
    },
    handle(async (args: { ticker: string; depth?: number }) =>
      client.request("GET", `/markets/${encodeURIComponent(args.ticker)}/orderbook`, {
        query: { depth: args.depth },
      })
    )
  );

  server.registerTool(
    "kalshi_get_market_candlesticks",
    {
      title: "Get market candlesticks",
      description:
        "Get historical OHLC candlestick data for a Kalshi market (price/volume/open-interest over time). " +
        "Requires the series ticker of the market plus a time range and interval.",
      inputSchema: {
        series_ticker: z.string().describe("Series the market belongs to (e.g. 'KXHIGHNY')"),
        ticker: z.string().describe("Market ticker"),
        start_ts: z.number().int().describe("Start of range (Unix seconds); candlesticks ending on/after this"),
        end_ts: z.number().int().describe("End of range (Unix seconds); candlesticks ending on/before this"),
        period_interval: z
          .union([z.literal(1), z.literal(60), z.literal(1440)])
          .describe("Candle length in minutes: 1 (minute), 60 (hour), or 1440 (day)"),
      },
    },
    handle(async (args: { series_ticker: string; ticker: string; start_ts: number; end_ts: number; period_interval: number }) =>
      client.request(
        "GET",
        `/series/${encodeURIComponent(args.series_ticker)}/markets/${encodeURIComponent(args.ticker)}/candlesticks`,
        {
          query: {
            start_ts: args.start_ts,
            end_ts: args.end_ts,
            period_interval: args.period_interval,
          },
        }
      )
    )
  );

  server.registerTool(
    "kalshi_get_trades",
    {
      title: "Get recent trades",
      description:
        "Get executed trades across all Kalshi markets, or for one market if a ticker is given. Prices in cents. " +
        paginationNote,
      inputSchema: {
        ticker: z.string().optional().describe("Filter to a single market ticker"),
        limit: z.number().int().min(1).max(1000).optional().describe("Results per page (1-1000, default 100)"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        min_ts: z.number().int().optional().describe("Only trades at/after this Unix timestamp"),
        max_ts: z.number().int().optional().describe("Only trades at/before this Unix timestamp"),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/markets/trades", { query: args })
    )
  );
}
