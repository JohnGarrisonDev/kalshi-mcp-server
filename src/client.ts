import { constants, createPrivateKey, sign as cryptoSign, KeyObject } from "node:crypto";
import type { KalshiConfig } from "./config.js";

export type QueryParams = Record<string, string | number | boolean | undefined>;

export class KalshiApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    method: string,
    path: string
  ) {
    super(`Kalshi API error ${status} on ${method} ${path}: ${body}`);
    this.name = "KalshiApiError";
  }
}

/**
 * Thin client over the Kalshi trade API v2.
 *
 * Public endpoints (markets, events, exchange info) work without credentials.
 * Authenticated endpoints require an API key ID plus an RSA private key; each
 * request is signed with RSA-PSS/SHA-256 over `timestamp + method + path`
 * (path without query string), per Kalshi's API key documentation.
 */
export class KalshiClient {
  private readonly privateKey?: KeyObject;

  constructor(private readonly config: KalshiConfig) {
    if (config.privateKeyPem) {
      this.privateKey = createPrivateKey(config.privateKeyPem);
    }
  }

  get hasCredentials(): boolean {
    return Boolean(this.config.apiKeyId && this.privateKey);
  }

  get environment(): string {
    return this.config.environment;
  }

  private signRequest(method: string, fullPath: string): Record<string, string> {
    if (!this.config.apiKeyId || !this.privateKey) {
      throw new Error(
        "This tool requires Kalshi API credentials. Set KALSHI_API_KEY_ID and " +
          "KALSHI_PRIVATE_KEY_PATH (or KALSHI_PRIVATE_KEY) in the MCP server environment."
      );
    }
    const timestamp = Date.now().toString();
    const message = timestamp + method + fullPath;
    const signature = cryptoSign("sha256", Buffer.from(message, "utf8"), {
      key: this.privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }).toString("base64");

    return {
      "KALSHI-ACCESS-KEY": this.config.apiKeyId,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
      "KALSHI-ACCESS-SIGNATURE": signature,
    };
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options: { query?: QueryParams; body?: unknown; auth?: boolean } = {}
  ): Promise<T> {
    const fullPath = this.config.pathPrefix + path;
    const url = new URL(this.config.baseUrl + fullPath);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt++) {
      // Signature covers the path only — no host, no query string. Re-sign on
      // each attempt so the timestamp stays fresh across retries.
      const response = await fetch(url, {
        method,
        headers: options.auth ? { ...headers, ...this.signRequest(method, fullPath) } : headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (response.status === 429 && attempt < maxAttempts) {
        // Basic rate-limit backoff.
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        throw new KalshiApiError(response.status, text, method, path);
      }
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    }
  }
}
