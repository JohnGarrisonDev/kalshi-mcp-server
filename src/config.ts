import { readFileSync } from "node:fs";

export interface KalshiConfig {
  /** REST base URL, e.g. https://api.elections.kalshi.com */
  baseUrl: string;
  /** Path prefix that is part of every endpoint and of the signed message. */
  pathPrefix: string;
  /** Kalshi API key ID (KALSHI-ACCESS-KEY header). Undefined = public-only mode. */
  apiKeyId?: string;
  /** PEM-encoded RSA private key used for request signing. */
  privateKeyPem?: string;
  /** Whether order-mutating tools (create/cancel/amend) are registered. */
  tradingEnabled: boolean;
  /** "prod" or "demo" */
  environment: "prod" | "demo";
}

const PROD_BASE = "https://api.elections.kalshi.com";
const DEMO_BASE = "https://demo-api.kalshi.co";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): KalshiConfig {
  const environment = (env.KALSHI_ENV ?? "prod").toLowerCase() === "demo" ? "demo" : "prod";
  const baseUrl = env.KALSHI_BASE_URL ?? (environment === "demo" ? DEMO_BASE : PROD_BASE);

  const apiKeyId = env.KALSHI_API_KEY_ID?.trim() || undefined;

  let privateKeyPem: string | undefined;
  if (env.KALSHI_PRIVATE_KEY_PATH) {
    privateKeyPem = readFileSync(env.KALSHI_PRIVATE_KEY_PATH, "utf8");
  } else if (env.KALSHI_PRIVATE_KEY) {
    // Allow the PEM to be passed inline with literal \n escapes.
    privateKeyPem = env.KALSHI_PRIVATE_KEY.replace(/\\n/g, "\n");
  }

  return {
    baseUrl,
    pathPrefix: "/trade-api/v2",
    apiKeyId,
    privateKeyPem,
    tradingEnabled: (env.KALSHI_ENABLE_TRADING ?? "").toLowerCase() === "true",
    environment,
  };
}
