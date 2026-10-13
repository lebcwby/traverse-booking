/**
 * Remote MCP server — Streamable HTTP transport. Phase 8 of
 * docs/phase2-ai-agent-booking.md.
 *
 * JSON-RPC 2.0 over POST. Hand-rolled rather than pulling in
 * @modelcontextprotocol/sdk: this implements three methods over an existing
 * service layer, and the whole surface is ~150 lines that can be read in one
 * sitting. Adding a dependency to a production booking site earns its keep
 * when it saves real complexity; here it would not.
 *
 * Responses are plain `application/json`. The Streamable HTTP transport
 * permits a single JSON response to a POST — SSE is only needed for a server
 * that streams or initiates messages, and this one answers and stops.
 *
 * Read-only. No quote tool, no booking, no writes, no auth, no PII: every
 * tool reads the same cached Postgres the /agent/v1 endpoints use, so a
 * conversation costs Guesty nothing.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  callMcpTool,
  MCP_SERVER_INFO,
  MCP_TOOLS,
  negotiateProtocolVersion,
} from "@/lib/mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** JSON-RPC 2.0 reserved codes. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

type Id = string | number | null;

function rpcResult(id: Id, result: unknown) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, result },
    { headers: { "cache-control": "no-store" } }
  );
}

function rpcError(id: Id, code: number, message: string, status = 200) {
  // JSON-RPC errors ride a 200 by convention — the HTTP call succeeded, the
  // RPC did not. A non-2xx is reserved for transport-level failures, which a
  // client may retry.
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: { "cache-control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, PARSE_ERROR, "Request body is not valid JSON.", 400);
  }

  // Batches are not supported. Rejecting explicitly beats silently handling
  // only the first entry, which would look like data loss to a client.
  if (Array.isArray(body)) {
    return rpcError(
      null,
      INVALID_REQUEST,
      "Batched requests are not supported; send one JSON-RPC request per POST.",
      400
    );
  }
  if (!body || typeof body !== "object") {
    return rpcError(null, INVALID_REQUEST, "Expected a JSON-RPC object.", 400);
  }

  const {
    method,
    id = null,
    params,
  } = body as {
    method?: string;
    id?: Id;
    params?: Record<string, unknown>;
  };

  if (typeof method !== "string") {
    return rpcError(id, INVALID_REQUEST, "Missing 'method'.", 400);
  }

  // Notifications carry no id and expect no body. `notifications/initialized`
  // is the one a client sends after the handshake.
  if (method.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202 });
  }

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: negotiateProtocolVersion(params?.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions:
            "Read-only access to Traverse Hospitality's Colorado vacation rentals. Search needs explicit dates. Prices are indicative and accommodation-only — the all-in total is calculated at checkout. There is no booking or payment tool: send the traveller to the listing url to book.",
        });

      case "ping":
        return rpcResult(id, {});

      case "tools/list":
        return rpcResult(id, { tools: MCP_TOOLS });

      case "tools/call": {
        const name = params?.name;
        if (typeof name !== "string") {
          return rpcError(id, INVALID_REQUEST, "Missing tool name.");
        }
        const args =
          params?.arguments && typeof params.arguments === "object"
            ? (params.arguments as Record<string, unknown>)
            : {};
        if (!MCP_TOOLS.some((t) => t.name === name)) {
          return rpcError(id, METHOD_NOT_FOUND, `Unknown tool: ${name}`);
        }
        return rpcResult(id, await callMcpTool(name, args));
      }

      default:
        return rpcError(id, METHOD_NOT_FOUND, `Unknown method: ${method}`);
    }
  } catch (err) {
    // Never leak an internal error to a model — it would faithfully relay it
    // to a guest. Log it, return something actionable.
    console.error("[mcp] handler failed:", method, err);
    return rpcError(
      id,
      INTERNAL_ERROR,
      "The server could not complete that request. Please retry shortly."
    );
  }
}

/**
 * A client may open a GET for a server-initiated SSE stream. This server
 * never initiates, so declining is correct and the spec expects 405.
 */
export async function GET() {
  return new NextResponse(
    JSON.stringify({
      error:
        "This MCP server does not provide a server-initiated SSE stream. POST JSON-RPC requests to this same URL.",
    }),
    {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow: "POST",
      },
    }
  );
}
