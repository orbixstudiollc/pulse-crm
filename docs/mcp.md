# MCP server

Pulse CRM runs a remote [MCP](https://modelcontextprotocol.io) server at `/api/mcp` (Streamable HTTP, stateless). Any MCP client (Claude Code, Claude Desktop, Codex, Cursor and others) can use it to search and update the CRM.

Production URL: `https://pulse-crm-weld.vercel.app/api/mcp`

## Setup

1. Apply `supabase/migrations/036_api_keys.sql` in the Supabase SQL editor.
2. In the app, open **Settings → API & MCP** (admins and owners only) and create a key. Pick **Read & write** to let the AI change records, or **Read only**. The key (`pcrm_…`) is shown once.
3. Connect a client (the settings page shows these commands with your URL and key filled in).

### Claude Code

```bash
claude mcp add --transport http pulse-crm https://pulse-crm-weld.vercel.app/api/mcp \
  --header "Authorization: Bearer pcrm_..."
```

Add `--scope user` to make it available in every project. Check with `/mcp` inside Claude Code. The `daily_briefing` and `pipeline_review` prompts appear as `/mcp__pulse-crm__daily_briefing` and `/mcp__pulse-crm__pipeline_review`.

### Codex CLI

```bash
export PULSE_CRM_API_KEY=pcrm_...
codex mcp add pulse-crm --url https://pulse-crm-weld.vercel.app/api/mcp \
  --bearer-token-env-var PULSE_CRM_API_KEY
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.pulse-crm]
url = "https://pulse-crm-weld.vercel.app/api/mcp"
bearer_token_env_var = "PULSE_CRM_API_KEY"
```

### Claude Desktop, Cursor and other JSON-configured clients

These take a local command, so bridge with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "pulse-crm": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://pulse-crm-weld.vercel.app/api/mcp",
               "--header", "Authorization: Bearer pcrm_..."]
    }
  }
}
```

Custom connectors on claude.ai (web and mobile) need OAuth, which this server does not offer yet.

### Any other client

POST JSON-RPC to `/api/mcp` with `Authorization: Bearer pcrm_...` (or `x-api-key: pcrm_...`) and `Accept: application/json, text/event-stream`.

## Tools

Read (every key): `get_workspace_summary`, `search_leads`, `get_lead`, `list_followups`, `search_deals`, `get_deal`, `search_customers`, `get_customer`, `search_contacts`, `list_activities`, `list_calendar_events`, `list_campaigns`.

Write (read & write keys only; read-only keys never see these): `create_lead`, `update_lead`, `set_followup`, `convert_lead_to_customer`, `create_deal`, `update_deal`, `create_customer`, `update_customer`, `create_contact`, `update_contact`, `create_activity`, `update_activity`, `create_calendar_event`, `add_note`, `delete_record`.

## How it works

- `app/api/mcp/route.ts` authenticates the key (`lib/mcp/api-keys.ts`), then builds an `McpServer` bound to the key's workspace (`lib/mcp/server.ts`).
- Tools use the service-role client and filter every query by the key's `organization_id`; references to other records (`customer_id`, `lead_id`, `related_id`) are checked against the same workspace. The server actions in `lib/actions/` could not be reused directly: they read the workspace from the login cookie and several look records up by id alone, relying on RLS, which the service role bypasses.
- Writes are attributed to the profile that created the key (`created_by`, note author). Creating or updating a lead scores it (`lib/leads/score.ts`, shared with the Leads page) and runs the workspace's automation rules, like the Leads page does. ICP matching is not re-run.
- Results are compact JSON: empty fields are dropped and list tools return summary columns, to keep the model's context small.
- Keys are stored as SHA-256 hashes. Revoking a key in Settings cuts it off on the next request.

Tests: `tests/mcp-server.test.ts` drives the route with the real MCP client against an in-memory database.
