import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KalshiClient } from "../client.js";
import { handle } from "../helpers.js";

export function registerExchangeTools(server: McpServer, client: KalshiClient): void {
  server.registerTool(
    "kalshi_get_exchange_status",
    {
      title: "Get exchange status",
      description:
        "Get the current operational status of the Kalshi exchange (whether trading and the exchange are active).",
      inputSchema: {},
    },
    handle(async () => client.request("GET", "/exchange/status"))
  );

  server.registerTool(
    "kalshi_get_exchange_schedule",
    {
      title: "Get exchange schedule",
      description:
        "Get the Kalshi exchange trading schedule, including standard weekly hours and scheduled maintenance windows.",
      inputSchema: {},
    },
    handle(async () => client.request("GET", "/exchange/schedule"))
  );

  server.registerTool(
    "kalshi_get_exchange_announcements",
    {
      title: "Get exchange announcements",
      description: "Get all current exchange-wide announcements from Kalshi.",
      inputSchema: {},
    },
    handle(async () => client.request("GET", "/exchange/announcements"))
  );

  server.registerTool(
    "kalshi_get_series_fee_changes",
    {
      title: "Get series fee changes",
      description:
        "Get upcoming or recent maker/taker fee changes for Kalshi series. Optionally filter by series ticker.",
      inputSchema: {
        series_ticker: z.string().optional().describe("Filter fee changes to a single series ticker"),
        show_historical: z.boolean().optional().describe("Include past fee changes (default false)"),
      },
    },
    handle(async (args: { series_ticker?: string; show_historical?: boolean }) =>
      client.request("GET", "/series/fee_changes", {
        query: { series_ticker: args.series_ticker, show_historical: args.show_historical },
      })
    )
  );
}
