"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Badge, Button, CopyIcon, CheckIcon, DeleteConfirmModal, Input, Select, Toast } from "@/components/ui";
import { Section, TableSection } from "@/components/dashboard";
import { createApiKey, getApiKeys, revokeApiKey, type ApiKeyRow } from "@/lib/actions/api-keys";

// Settings → API & MCP: workspace API keys for the MCP server at /api/mcp.

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      leftIcon={copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative mt-2">
      <pre className="overflow-x-auto rounded-md border border-line bg-muted p-3 pr-24 text-[12px] leading-5 text-fg">
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Never";
}

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("write");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const serverUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";
  const keyForSnippets = newKey ?? "YOUR_API_KEY";

  const load = async () => {
    const res = await getApiKeys();
    if (res.error) setToast({ message: res.error, variant: "error" });
    setKeys(res.data);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads server data into local state, like the other settings sections
  useEffect(() => { load(); }, []);

  const handleCreate = () => {
    startTransition(async () => {
      const res = await createApiKey({ name, scope });
      if (res.error || !res.key) {
        setToast({ message: res.error ?? "Failed to create key", variant: "error" });
        return;
      }
      setNewKey(res.key);
      setName("");
      await load();
    });
  };

  const handleRevoke = () => {
    if (!revokeTarget) return;
    startTransition(async () => {
      const res = await revokeApiKey(revokeTarget.id);
      setRevokeTarget(null);
      if (res.error) setToast({ message: res.error, variant: "error" });
      else setToast({ message: "Key revoked", variant: "success" });
      await load();
    });
  };

  const sectionClass = "px-0 max-sm:px-0 first-of-type:border-t-0";

  return (
    <>
      <p className="mt-1 text-[13px] text-fg-muted">
        Connect Claude, Codex or any other MCP client to this workspace. The AI can then search and update
        leads, deals, customers, contacts, tasks and the calendar.
      </p>

      <Section className={sectionClass} title="Server URL">
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-muted px-3 py-2 text-[13px] text-fg">
            {serverUrl}
          </code>
          <CopyButton text={serverUrl} />
        </div>
      </Section>

      <Section
        className={sectionClass}
        title="Create an API key"
        description="Read & write keys can create, edit and delete records. Read-only keys only see the search tools."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Name"
              placeholder="e.g. Claude Code on my laptop"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="w-[180px]">
            <Select label="Access" value={scope} onChange={(e) => setScope(e.target.value as "read" | "write")}>
              <option value="write">Read &amp; write</option>
              <option value="read">Read only</option>
            </Select>
          </div>
          <Button onClick={handleCreate} loading={isPending} disabled={!name.trim()}>
            Create key
          </Button>
        </div>

        {newKey && (
          <div className="mt-4 rounded-md border border-warning bg-warning-surface p-3">
            <p className="text-[13px] font-medium text-fg">Copy this key now. It will not be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-fg">
                {newKey}
              </code>
              <CopyButton text={newKey} />
            </div>
          </div>
        )}
      </Section>

      <Section className={sectionClass} title="Keys">
        {loading ? (
          <p className="text-[13px] text-fg-muted">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No keys yet.</p>
        ) : (
          <TableSection className="-mx-8 max-lg:-mx-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Name</th>
                    <th className="text-left">Key</th>
                    <th className="text-left">Access</th>
                    <th className="text-left">Last used</th>
                    <th className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className={cn(key.revoked_at && "opacity-60")}>
                      <td className="py-2 text-[14px] text-fg">{key.name}</td>
                      <td className="py-2 font-mono text-[12px] text-fg-secondary">{key.key_prefix}…</td>
                      <td className="py-2">
                        <Badge variant={key.scope === "write" ? "primary" : "neutral"}>
                          {key.scope === "write" ? "Read & write" : "Read only"}
                        </Badge>
                      </td>
                      <td className="py-2 text-[13px] text-fg-secondary">{formatDate(key.last_used_at)}</td>
                      <td className="py-2 text-right">
                        {key.revoked_at ? (
                          <span className="text-[13px] text-fg-muted">Revoked</span>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(key)}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableSection>
        )}
      </Section>

      <Section
        className={sectionClass}
        title="Connect a client"
        description={newKey ? "These commands include the key you just created." : "Replace YOUR_API_KEY with a key from above."}
      >
        <p className="text-[13px] font-medium text-fg">Claude Code</p>
        <CodeBlock
          code={`claude mcp add --transport http pulse-crm ${serverUrl} --header "Authorization: Bearer ${keyForSnippets}"`}
        />

        <p className="mt-5 text-[13px] font-medium text-fg">Codex CLI</p>
        <CodeBlock
          code={`export PULSE_CRM_API_KEY=${keyForSnippets}\ncodex mcp add pulse-crm --url ${serverUrl} --bearer-token-env-var PULSE_CRM_API_KEY`}
        />

        <p className="mt-5 text-[13px] font-medium text-fg">Claude Desktop, Cursor and other JSON-configured clients</p>
        <CodeBlock
          code={JSON.stringify(
            {
              mcpServers: {
                "pulse-crm": {
                  command: "npx",
                  args: ["-y", "mcp-remote", serverUrl, "--header", `Authorization: Bearer ${keyForSnippets}`],
                },
              },
            },
            null,
            2,
          )}
        />
      </Section>

      <DeleteConfirmModal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke API key"
        description="Clients using this key lose access immediately. This cannot be undone."
        itemName={revokeTarget?.name}
        loading={isPending}
      />

      <Toast
        open={!!toast}
        onClose={() => setToast(null)}
        message={toast?.message ?? ""}
        variant={toast?.variant}
      />
    </>
  );
}
