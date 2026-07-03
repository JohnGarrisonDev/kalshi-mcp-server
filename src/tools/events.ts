import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KalshiClient } from "../client.js";
import { handle } from "../helpers.js";

export function registerEventTools(server: McpServer, client: KalshiClient): void {
  server.registerTool(
    "kalshi_list_events",
    {
      title: "List events",
      description:
        "List Kalshi events (groupings of related markets, e.g. 'Highest temperature in NYC on Jul 3'). " +
        "Filter by status or series. Set with_nested_markets to include each event's markets inline. " +
        "Responses are paginated; pass the returned `cursor` back in for the next page.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional().describe("Results per page (1-200, default 100)"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        status: z
          .enum(["unopened", "open", "closed", "settled"])
          .optional()
          .describe("Filter by event status"),
        series_ticker: z.string().optional().describe("Filter to events in this series"),
        with_nested_markets: z.boolean().optional().describe("Include each event's markets in the response"),
      },
    },
    handle(async (args: Record<string, string | number | boolean | undefined>) =>
      client.request("GET", "/events", { query: args })
    )
  );

  server.registerTool(
    "kalshi_get_event",
    {
      title: "Get event",
      description:
        "Get a single Kalshi event by its event ticker, including its markets when with_nested_markets is true.",
      inputSchema: {
        event_ticker: z.string().describe("Event ticker, e.g. 'KXHIGHNY-25JUL03'"),
        with_nested_markets: z.boolean().optional().describe("Include the event's markets in the response"),
      },
    },
    handle(async (args: { event_ticker: string; with_nested_markets?: boolean }) =>
      client.request("GET", `/events/${encodeURIComponent(args.event_ticker)}`, {
        query: { with_nested_markets: args.with_nested_markets },
      })
    )
  );

  server.registerTool(
    "kalshi_get_event_metadata",
    {
      title: "Get event metadata",
      description:
        "Get display metadata for a Kalshi event (image URLs, competition context, settlement sources).",
      inputSchema: {
        event_ticker: z.string().describe("Event ticker"),
      },
    },
    handle(async (args: { event_ticker: string }) =>
      client.request("GET", `/events/${encodeURIComponent(args.event_ticker)}/metadata`)
    )
  );

  server.registerTool(
    "kalshi_list_series",
    {
      title: "List series",
      description:
        "List Kalshi series (recurring market templates, e.g. 'KXHIGHNY' = daily NYC high temperature). " +
        "Category is required by the API; use kalshi_get_series if you already know the ticker. " +
        "Example categories: 'Politics', 'Economics', 'Climate and Weather', 'Financials', 'Sports', 'Entertainment', 'Science and Technology', 'World', 'Crypto', 'Health', 'Companies'.",
      inputSchema: {
        category: z.string().describe("Series category to list, e.g. 'Economics'"),
        include_product_metadata: z.boolean().optional().describe("Include additional product metadata"),
      },
    },
    handle(async (args: { category: string; include_product_metadata?: boolean }) =>
      client.request("GET", "/series", { query: args as Record<string, string | boolean> })
    )
  );

  server.registerTool(
    "kalshi_get_series",
    {
      title: "Get series",
      description:
        "Get a single Kalshi series by ticker: title, category, frequency, settlement sources, and fee type.",
      inputSchema: {
        series_ticker: z.string().describe("Series ticker, e.g. 'KXHIGHNY'"),
      },
    },
    handle(async (args: { series_ticker: string }) =>
      client.request("GET", `/series/${encodeURIComponent(args.series_ticker)}`)
    )
  );

  server.registerTool(
    "kalshi_list_milestones",
    {
      title: "List milestones",
      description:
        "List Kalshi milestones — real-world data checkpoints (economic releases, game results, weather readings) that markets settle against.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional().describe("Results per page"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        minimum_start_date: z
          .string()
          .optional()
          .describe("Only milestones starting on/after this RFC3339 date-time, e.g. '2026-07-01T00:00:00Z'"),
        category: z.string().optional().describe("Filter by milestone category"),
        type: z.string().optional().describe("Filter by milestone type"),
        related_event_ticker: z.string().optional().describe("Filter to milestones related to this event"),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/milestones", { query: args })
    )
  );

  server.registerTool(
    "kalshi_get_milestone",
    {
      title: "Get milestone",
      description: "Get a single Kalshi milestone by its ID.",
      inputSchema: {
        milestone_id: z.string().describe("Milestone ID"),
      },
    },
    handle(async (args: { milestone_id: string }) =>
      client.request("GET", `/milestones/${encodeURIComponent(args.milestone_id)}`)
    )
  );

  server.registerTool(
    "kalshi_list_multivariate_collections",
    {
      title: "List multivariate event collections",
      description:
        "List Kalshi multivariate event collections — parameterized market families (e.g. head-to-head combinations) where individual markets are created on demand.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional().describe("Results per page"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        status: z.string().optional().describe("Filter by collection status"),
        associated_event_ticker: z.string().optional().describe("Filter by associated event ticker"),
        series_ticker: z.string().optional().describe("Filter by series ticker"),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/multivariate_event_collections/", { query: args })
    )
  );

  server.registerTool(
    "kalshi_get_multivariate_collection",
    {
      title: "Get multivariate event collection",
      description: "Get a single Kalshi multivariate event collection by its collection ticker.",
      inputSchema: {
        collection_ticker: z.string().describe("Collection ticker"),
      },
    },
    handle(async (args: { collection_ticker: string }) =>
      client.request("GET", `/multivariate_event_collections/${encodeURIComponent(args.collection_ticker)}`)
    )
  );
}
