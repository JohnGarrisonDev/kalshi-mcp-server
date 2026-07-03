import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Wrap a tool handler so API failures come back as readable tool errors. */
export function handle<Args>(
  fn: (args: Args) => Promise<unknown>
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args) => {
    try {
      const data = await fn(args);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
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
