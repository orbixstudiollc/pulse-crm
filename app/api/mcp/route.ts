import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiKey, extractApiKey } from "@/lib/mcp/api-keys";
import { createPulseMcpServer } from "@/lib/mcp/server";

// Remote MCP server (Streamable HTTP) for Claude, Codex and other MCP clients.
// Auth: "Authorization: Bearer pcrm_..." — a workspace API key from
// Settings → API & MCP. Setup steps: docs/mcp.md.
//
// Stateless: every request builds a server for the key's workspace, so it
// runs on serverless without session affinity.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonRpcError(status: number, message: string, headers?: HeadersInit) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }),
    { status, headers: { "Content-Type": "application/json", ...headers } },
  );
}

async function handle(request: Request): Promise<Response> {
  const ctx = await authenticateApiKey(extractApiKey(request.headers));
  if (!ctx) {
    return jsonRpcError(401, "Missing or invalid API key. Create one in Pulse CRM under Settings → API & MCP.", {
      "WWW-Authenticate": 'Bearer realm="pulse-crm"',
    });
  }

  const server = createPulseMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // JSON responses are complete once handleRequest resolves.
    void server.close();
  }
}

export async function POST(request: Request) {
  return handle(request);
}

// Stateless servers have no server-initiated stream or session to end.
export async function GET() {
  return jsonRpcError(405, "Method not allowed", { Allow: "POST" });
}

export async function DELETE() {
  return jsonRpcError(405, "Method not allowed", { Allow: "POST" });
}
