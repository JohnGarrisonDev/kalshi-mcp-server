import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Hard cap on serialized tool-result size. Claude Desktop (and most MCP
 * clients) reject or choke on very large tool results, so anything bigger
 * gets trimmed with an explanatory note rather than erroring downstream.
 */
const MAX_RESPONSE_CHARS = 40_000;

/**
 * Serialize a response, trimming the largest top-level array if the payload
 * exceeds MAX_RESPONSE_CHARS. Output is compact JSON (no indentation) to keep
 * token usage down.
 */
export function serializeResult(data: unknown): string {
  let text = JSON.stringify(data);
  if (text.length <= MAX_RESPONSE_CHARS) return text;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj: Record<string, unknown> = { ...(data as Record<string, unknown>) };
    const arrayEntry = Object.entries(obj)
      .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
      .sort((a, b) => b[1].length - a[1].length)[0];

    if (arrayEntry) {
      const [key, items] = arrayEntry;
      let keep = items.length;
      while (keep > 1) {
        keep = Math.ceil(keep / 2);
        obj[key] = items.slice(0, keep);
        obj._truncation_note =
          `Response was too large for the MCP client; showing the first ${keep} of ${items.length} '${key}' items. ` +
          `Note: any 'cursor' in this response points past ALL ${items.length} fetched items, so re-query with a smaller 'limit' ` +
          `and/or tighter filters instead of relying on the cursor to see the omitted items.`;
        text = JSON.stringify(obj);
        if (text.length <= MAX_RESPONSE_CHARS) return text;
      }
    }
  }

  return (
    text.slice(0, MAX_RESPONSE_CHARS) +
    ` ... [truncated: response exceeded ${MAX_RESPONSE_CHARS} characters; retry with a smaller 'limit' or tighter filters]`
  );
}

/** Wrap a tool handler so API failures come back as readable tool errors. */
export function handle<Args>(
  fn: (args: Args) => Promise<unknown>
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args) => {
    try {
      const data = await fn(args);
      return {
        content: [{ type: "text", text: serializeResult(data) }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  };
}

/** Keep only the listed keys of an object, dropping undefined values. */
export function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      out[key] = obj[key];
    }
  }
  return out;
}

/**
 * Fields kept for a market in compact list responses. Kalshi is migrating
 * from integer-cent fields (yes_bid) to fixed-point string fields
 * (yes_bid_dollars, volume_fp); keep both so prices survive either shape.
 */
export const COMPACT_MARKET_FIELDS = [
  "ticker",
  "event_ticker",
  "market_type",
  "title",
  "subtitle",
  "yes_sub_title",
  "no_sub_title",
  "status",
  "yes_bid",
  "yes_ask",
  "no_bid",
  "no_ask",
  "last_price",
  "previous_price",
  "yes_bid_dollars",
  "yes_ask_dollars",
  "no_bid_dollars",
  "no_ask_dollars",
  "last_price_dollars",
  "previous_price_dollars",
  "volume",
  "volume_24h",
  "open_interest",
  "liquidity",
  "volume_fp",
  "volume_24h_fp",
  "open_interest_fp",
  "open_time",
  "close_time",
  "expiration_time",
  "result",
  "can_close_early",
];

export function compactMarket(market: Record<string, unknown>): Record<string, unknown> {
  return pick(market, COMPACT_MARKET_FIELDS);
}

/** Fields kept for an event in compact list responses. */
export const COMPACT_EVENT_FIELDS = [
  "event_ticker",
  "series_ticker",
  "title",
  "sub_title",
  "category",
  "mutually_exclusive",
  "strike_date",
  "strike_period",
];

export function compactEvent(event: Record<string, unknown>): Record<string, unknown> {
  const out = pick(event, COMPACT_EVENT_FIELDS);
  const markets = (event as { markets?: Record<string, unknown>[] }).markets;
  if (Array.isArray(markets)) {
    out.markets = markets.map(compactMarket);
  }
  return out;
}

/** Fields kept for a series in compact list responses. */
export const COMPACT_SERIES_FIELDS = [
  "ticker",
  "title",
  "category",
  "frequency",
  "fee_type",
  "fee_multiplier",
  "tags",
];

export function compactSeries(series: Record<string, unknown>): Record<string, unknown> {
  return pick(series, COMPACT_SERIES_FIELDS);
}
