import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KalshiClient } from "../client.js";
import { handle } from "../helpers.js";

interface SeriesRecord {
  ticker?: string;
  title?: string;
  category?: string;
  frequency?: string;
  tags?: string[];
}

// Kalshi has no server-side text search, and its unfiltered /markets and
// /events listings do NOT return every market (many only appear when filtered
// by series ticker). The authoritative catalog is /series, which returns all
// series in a single call when no category is given. We fetch it once, cache
// it briefly, and filter locally so keyword discovery is reliable and cheap.
const CATALOG_TTL_MS = 5 * 60 * 1000;
let catalogCache: { at: number; series: SeriesRecord[] } | null = null;

async function getSeriesCatalog(client: KalshiClient): Promise<SeriesRecord[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.series;
  }
  const data = await client.request<{ series?: SeriesRecord[] }>("GET", "/series");
  const series = data.series ?? [];
  catalogCache = { at: Date.now(), series };
  return series;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "in", "on", "to", "and", "or", "is", "are",
  "will", "who", "what", "when", "which", "best", "current", "right", "now",
  "market", "markets", "trade", "trades", "prediction", "predictions", "contest",
  "me", "my", "give", "get", "show", "find", "please",
]);

/** Split text into lowercase alphanumeric tokens. */
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/** Collapse to a spaceless alphanumeric string so "hot dog" ~ "hotdog". */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scoreSeries(series: SeriesRecord, queryTokens: string[], queryNorm: string): number {
  const haystackParts = [
    series.ticker ?? "",
    series.title ?? "",
    series.category ?? "",
    ...(series.tags ?? []),
  ];
  const haystackTokens = new Set(haystackParts.flatMap(tokenize));
  const haystackNorm = normalize(haystackParts.join(" "));

  let score = 0;
  for (const token of queryTokens) {
    if (haystackTokens.has(token)) {
      score += 2; // exact whole-token match
    } else if (token.length >= 4 && haystackNorm.includes(token)) {
      score += 1; // substring / joined-word match (e.g. "hotdog")
    }
  }
  // Bonus if the whole normalized query appears (strong signal).
  if (queryNorm.length >= 4 && haystackNorm.includes(queryNorm)) {
    score += 3;
  }
  return score;
}

export function registerSearchTools(server: McpServer, client: KalshiClient): void {
  server.registerTool(
    "kalshi_search",
    {
      title: "Search Kalshi by keyword",
      description:
        "Find Kalshi series (market topics) by plain-language keywords when you don't know the exact ticker. " +
        "This is the entry point for questions like 'markets about the Nathan's hot dog contest' or 'Fed rate markets'. " +
        "Returns the best-matching series with their tickers; then call kalshi_list_markets or kalshi_list_events " +
        "with the chosen series_ticker to get the individual markets and prices. " +
        "Searches series titles, tickers, categories, and tags (Kalshi has no server-side full-text search, so this " +
        "scans the full series catalog locally).",
      inputSchema: {
        query: z
          .string()
          .describe("Keywords describing the topic, e.g. 'Nathan's hot dog eating contest' or 'Fed rate decision'"),
        limit: z.number().int().min(1).max(50).optional().describe("Max matching series to return (default 20)"),
        category: z
          .string()
          .optional()
          .describe("Optional category to restrict the search, e.g. 'Sports', 'Economics', 'Politics'"),
      },
    },
    handle(async (args: { query: string; limit?: number; category?: string }) => {
      const queryTokens = tokenize(args.query).filter((t) => !STOPWORDS.has(t));
      const queryNorm = normalize(args.query);
      if (queryTokens.length === 0 && queryNorm.length === 0) {
        return { query: args.query, matches: [], note: "Query had no searchable keywords." };
      }

      let catalog = await getSeriesCatalog(client);
      if (args.category) {
        const catNorm = normalize(args.category);
        catalog = catalog.filter((s) => normalize(s.category ?? "") === catNorm);
      }

      const scored = catalog
        .map((s) => ({ s, score: scoreSeries(s, queryTokens, queryNorm) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || (a.s.title ?? "").localeCompare(b.s.title ?? ""));

      const limit = args.limit ?? 20;
      const matches = scored.slice(0, limit).map(({ s, score }) => ({
        series_ticker: s.ticker,
        title: s.title,
        category: s.category,
        frequency: s.frequency,
        tags: s.tags,
        match_score: score,
      }));

      return {
        query: args.query,
        total_matches: scored.length,
        matches,
        next_step:
          matches.length > 0
            ? "Call kalshi_list_markets or kalshi_list_events with series_ticker set to one of the returned series_ticker values to see the individual markets and prices."
            : "No matching series found. Try broader or different keywords.",
      };
    })
  );
}
