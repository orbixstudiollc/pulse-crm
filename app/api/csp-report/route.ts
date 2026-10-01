import { CSP_REPORT_MAX_BYTES, parseCspReports } from "@/lib/security/csp";

// Receives Content-Security-Policy(-Report-Only) violation reports. Browsers
// send these without cookies, so this route needs no auth and stores nothing:
// it logs one compact line per violation (directive, blocked origin, document
// path; never full URLs or query strings) and returns 204.

const KINDS = {
  "application/csp-report": "csp-report",
  "application/reports+json": "reports+json",
} as const;

function empty(status: number): Response {
  return new Response(null, { status });
}

export async function POST(req: Request): Promise<Response> {
  const mediaType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const kind = KINDS[mediaType as keyof typeof KINDS];
  if (!kind) return empty(415);

  if (Number(req.headers.get("content-length") ?? 0) > CSP_REPORT_MAX_BYTES) return empty(413);
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > CSP_REPORT_MAX_BYTES) return empty(413);

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return empty(400);
  }

  for (const v of parseCspReports(body, kind)) {
    console.warn(`[csp-report] directive=${v.directive} blocked=${v.blocked} path=${v.documentPath}`);
  }
  return empty(204);
}
