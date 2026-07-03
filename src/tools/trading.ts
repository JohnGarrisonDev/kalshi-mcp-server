import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KalshiClient } from "../client.js";
import { handle } from "../helpers.js";

const tradingNote =
  " Only available because KALSHI_ENABLE_TRADING=true is set. Orders use REAL MONEY on the production environment.";

export function registerTradingTools(server: McpServer, client: KalshiClient): void {
  server.registerTool(
    "kalshi_create_order",
    {
      title: "Create order",
      description:
        "Place an order on a Kalshi market. Prices are in cents (1-99). For limit orders provide yes_price or " +
        "no_price (matching the chosen side). Market orders execute immediately at the best available price; " +
        "for market buys, buy_max_cost (cents) caps total spend." +
        tradingNote,
      inputSchema: {
        ticker: z.string().describe("Market ticker to trade"),
        action: z.enum(["buy", "sell"]).describe("Whether to buy or sell contracts"),
        side: z.enum(["yes", "no"]).describe("Which side of the market to trade"),
        count: z.number().int().min(1).describe("Number of contracts"),
        type: z.enum(["limit", "market"]).describe("Order type"),
        yes_price: z
          .number()
          .int()
          .min(1)
          .max(99)
          .optional()
          .describe("Limit price in cents for the yes side (use when side='yes')"),
        no_price: z
          .number()
          .int()
          .min(1)
          .max(99)
          .optional()
          .describe("Limit price in cents for the no side (use when side='no')"),
        client_order_id: z
          .string()
          .optional()
          .describe("Idempotency key; auto-generated UUID if omitted"),
        expiration_ts: z
          .number()
          .int()
          .optional()
          .describe(
            "Unix timestamp when a resting limit order expires. Omit for Good-Till-Canceled; set to a past time for Immediate-Or-Cancel"
          ),
        buy_max_cost: z
          .number()
          .int()
          .optional()
          .describe("Max total cost in cents for market buy orders"),
        post_only: z
          .boolean()
          .optional()
          .describe("If true, reject the order instead of letting it cross the spread (maker-only)"),
      },
    },
    handle(
      async (args: {
        ticker: string;
        action: "buy" | "sell";
        side: "yes" | "no";
        count: number;
        type: "limit" | "market";
        yes_price?: number;
        no_price?: number;
        client_order_id?: string;
        expiration_ts?: number;
        buy_max_cost?: number;
        post_only?: boolean;
      }) =>
        client.request("POST", "/portfolio/orders", {
          auth: true,
          body: {
            ...args,
            client_order_id: args.client_order_id ?? randomUUID(),
          },
        })
    )
  );

  server.registerTool(
    "kalshi_cancel_order",
    {
      title: "Cancel order",
      description: "Cancel a resting order (reduces its remaining count to zero)." + tradingNote,
      inputSchema: {
        order_id: z.string().describe("ID of the order to cancel"),
      },
    },
    handle(async (args: { order_id: string }) =>
      client.request("DELETE", `/portfolio/orders/${encodeURIComponent(args.order_id)}`, { auth: true })
    )
  );

  server.registerTool(
    "kalshi_amend_order",
    {
      title: "Amend order",
      description:
        "Amend a resting order's price and/or maximum fillable count. Provide the order's original attributes " +
        "(ticker, action, side) plus the new price/count." +
        tradingNote,
      inputSchema: {
        order_id: z.string().describe("ID of the order to amend"),
        ticker: z.string().describe("Market ticker of the order"),
        action: z.enum(["buy", "sell"]).describe("Original order action"),
        side: z.enum(["yes", "no"]).describe("Original order side"),
        count: z.number().int().min(1).describe("New maximum fillable count"),
        yes_price: z.number().int().min(1).max(99).optional().describe("New yes price in cents"),
        no_price: z.number().int().min(1).max(99).optional().describe("New no price in cents"),
        client_order_id: z.string().optional().describe("Original client order ID"),
        updated_client_order_id: z
          .string()
          .optional()
          .describe("New client order ID for the amended order; auto-generated if omitted"),
      },
    },
    handle(async (args: { order_id: string } & Record<string, unknown>) => {
      const { order_id, ...body } = args;
      return client.request("POST", `/portfolio/orders/${encodeURIComponent(order_id)}/amend`, {
        auth: true,
        body: {
          ...body,
          client_order_id: body.client_order_id ?? randomUUID(),
          updated_client_order_id: body.updated_client_order_id ?? randomUUID(),
        },
      });
    })
  );

  server.registerTool(
    "kalshi_decrease_order",
    {
      title: "Decrease order",
      description:
        "Decrease the remaining count of a resting order. Provide either reduce_by (contracts to remove) or " +
        "reduce_to (new remaining count)." +
        tradingNote,
      inputSchema: {
        order_id: z.string().describe("ID of the order to decrease"),
        reduce_by: z.number().int().min(1).optional().describe("Number of contracts to remove"),
        reduce_to: z.number().int().min(0).optional().describe("Target remaining contract count"),
      },
    },
    handle(async (args: { order_id: string; reduce_by?: number; reduce_to?: number }) =>
      client.request("POST", `/portfolio/orders/${encodeURIComponent(args.order_id)}/decrease`, {
        auth: true,
        body: { reduce_by: args.reduce_by, reduce_to: args.reduce_to },
      })
    )
  );
}
