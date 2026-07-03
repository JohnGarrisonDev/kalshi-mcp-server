import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KalshiClient } from "../client.js";
import { handle } from "../helpers.js";

const authNote =
  " Requires Kalshi API credentials (KALSHI_API_KEY_ID + private key) to be configured on the server.";

export function registerPortfolioTools(server: McpServer, client: KalshiClient): void {
  server.registerTool(
    "kalshi_get_balance",
    {
      title: "Get account balance",
      description: "Get the authenticated member's available balance and payout, in cents." + authNote,
      inputSchema: {},
    },
    handle(async () => client.request("GET", "/portfolio/balance", { auth: true }))
  );

  server.registerTool(
    "kalshi_get_positions",
    {
      title: "Get positions",
      description:
        "Get the authenticated member's market positions (contracts held, exposure, realized PnL in cents)." +
        authNote,
      inputSchema: {
        limit: z.number().int().min(1).max(1000).optional().describe("Results per page (default 50)"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        ticker: z.string().optional().describe("Filter to one market ticker"),
        event_ticker: z.string().optional().describe("Filter to one event ticker"),
        settlement_status: z
          .enum(["all", "settled", "unsettled"])
          .optional()
          .describe("Filter by settlement status (default 'unsettled')"),
        count_filter: z
          .string()
          .optional()
          .describe(
            "Comma-separated fields that must be non-zero, from: position, total_traded, resting_order_count"
          ),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/portfolio/positions", { query: { ...args, limit: args.limit ?? 50 }, auth: true })
    )
  );

  server.registerTool(
    "kalshi_get_fills",
    {
      title: "Get fills",
      description:
        "Get the authenticated member's trade fills (executions), optionally filtered by market, order, or time range." +
        authNote,
      inputSchema: {
        ticker: z.string().optional().describe("Filter to one market ticker"),
        order_id: z.string().optional().describe("Filter to fills of one order"),
        limit: z.number().int().min(1).max(1000).optional().describe("Results per page (default 50)"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        min_ts: z.number().int().optional().describe("Only fills at/after this Unix timestamp"),
        max_ts: z.number().int().optional().describe("Only fills at/before this Unix timestamp"),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/portfolio/fills", { query: { ...args, limit: args.limit ?? 50 }, auth: true })
    )
  );

  server.registerTool(
    "kalshi_get_settlements",
    {
      title: "Get settlements",
      description:
        "Get the authenticated member's settlement history (how settled markets resolved and resulting payouts, in cents)." +
        authNote,
      inputSchema: {
        limit: z.number().int().min(1).max(1000).optional().describe("Results per page (default 50)"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        ticker: z.string().optional().describe("Filter to one market ticker"),
        event_ticker: z.string().optional().describe("Filter to one event ticker"),
        min_ts: z.number().int().optional().describe("Only settlements at/after this Unix timestamp"),
        max_ts: z.number().int().optional().describe("Only settlements at/before this Unix timestamp"),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/portfolio/settlements", { query: { ...args, limit: args.limit ?? 50 }, auth: true })
    )
  );

  server.registerTool(
    "kalshi_list_orders",
    {
      title: "List orders",
      description:
        "List the authenticated member's orders, optionally filtered by market, event, or status (resting, canceled, executed)." +
        authNote,
      inputSchema: {
        ticker: z.string().optional().describe("Filter to one market ticker"),
        event_ticker: z.string().optional().describe("Filter to one event ticker"),
        status: z
          .enum(["resting", "canceled", "executed"])
          .optional()
          .describe("Filter by order status"),
        limit: z.number().int().min(1).max(1000).optional().describe("Results per page (default 50)"),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
        min_ts: z.number().int().optional().describe("Only orders created at/after this Unix timestamp"),
        max_ts: z.number().int().optional().describe("Only orders created at/before this Unix timestamp"),
      },
    },
    handle(async (args: Record<string, string | number | undefined>) =>
      client.request("GET", "/portfolio/orders", { query: { ...args, limit: args.limit ?? 50 }, auth: true })
    )
  );

  server.registerTool(
    "kalshi_get_order",
    {
      title: "Get order",
      description: "Get a single order belonging to the authenticated member, by order ID." + authNote,
      inputSchema: {
        order_id: z.string().describe("Order ID"),
      },
    },
    handle(async (args: { order_id: string }) =>
      client.request("GET", `/portfolio/orders/${encodeURIComponent(args.order_id)}`, { auth: true })
    )
  );
}
