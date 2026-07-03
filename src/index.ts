#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { KalshiClient } from "./client.js";
import { registerExchangeTools } from "./tools/exchange.js";
import { registerMarketTools } from "./tools/markets.js";
import { registerEventTools } from "./tools/events.js";
import { registerPortfolioTools } from "./tools/portfolio.js";
import { registerTradingTools } from "./tools/trading.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new KalshiClient(config);

  const server = new McpServer({
    name: "kalshi",
    version: "1.0.0",
  });

  // Public market data — always available, no credentials required.
  registerExchangeTools(server, client);
  registerMarketTools(server, client);
  registerEventTools(server, client);

  // Portfolio reads — registered always; they return a clear error message
  // explaining how to configure credentials when none are present.
  registerPortfolioTools(server, client);

  // Order placement/mutation — only registered with an explicit opt-in, so a
  // default install can never move money.
  if (config.tradingEnabled) {
    if (!client.hasCredentials) {
      console.error(
        "kalshi-mcp-server: KALSHI_ENABLE_TRADING=true but no credentials configured; trading tools disabled."
      );
    } else {
      registerTradingTools(server, client);
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `kalshi-mcp-server running (env=${config.environment}, credentials=${client.hasCredentials ? "yes" : "no"}, trading=${
      config.tradingEnabled && client.hasCredentials ? "enabled" : "disabled"
    })`
  );
}

main().catch((error) => {
  console.error("kalshi-mcp-server fatal error:", error);
  process.exit(1);
});
