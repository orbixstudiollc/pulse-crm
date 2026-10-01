"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { GearIcon, Switch } from "@/components/ui";
import { Page, PageHeader, Section } from "@/components/dashboard";
import { clearChatHistory, setAlwaysAllow, type CopilotSettings } from "@/lib/actions/copilot-settings";
import { BTN_OUTLINE, FIELD, LABEL } from "./styles";

const CLEAR_CONFIRM_TEXT = "CLEAR";

const SOURCE_LABELS: Record<CopilotSettings["provider"]["source"], string> = {
  org: "Your workspace key",
  env: "Shared Pulse key",
  none: "Not configured",
};

const BTN_DANGER =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-danger px-3 text-[14px] font-medium text-on-inverse transition-colors hover:bg-danger/90 disabled:opacity-50";

function formatTokens(value: number): string {
  return value.toLocaleString("en-US");
}

/** A hairline progress row: label and "used / limit" above a 4px track. */
function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isNearLimit = percent >= 90;
  return (
    <div className="py-3 border-b border-divider first:pt-0 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4 text-[13px]">
        <span className="text-fg">{label}</span>
        <span className="text-fg-muted">
          {formatTokens(used)}
          {limit !== null ? ` / ${formatTokens(limit)} tokens` : " tokens, no limit"}
        </span>
      </div>
      {limit !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className={isNearLimit ? "h-full bg-danger" : "h-full bg-accent"} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

function ProviderRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </>
  );
}

export function SettingsView({
  initial,
  onHistoryCleared,
}: {
  /** null when the settings could not be loaded on the server. */
  initial: CopilotSettings | null;
  onHistoryCleared?: () => void;
}) {
  const [alwaysAllow, setAlwaysAllowState] = useState<string[]>(initial?.alwaysAllow ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  if (!initial) {
    return (
      <div className="flex-1 overflow-y-auto">
        <Page>
          <PageHeader icon={<GearIcon size={18} />} title="Copilot Settings" />
          <Section>
            <p className="text-[14px] text-fg">Copilot settings could not be loaded.</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">Refresh the page to try again.</p>
          </Section>
        </Page>
      </div>
    );
  }

  const { provider, allowableTools, usage } = initial;

  // Optimistic: flip the toggle now, then let the server's list replace local state
  // so a name the server dropped reverts visibly.
  const handleToggle = async (name: string, enabled: boolean) => {
    const previous = alwaysAllow;
    const next = enabled ? [...previous.filter((tool) => tool !== name), name] : previous.filter((tool) => tool !== name);
    setAlwaysAllowState(next);
    setIsSaving(true);
    try {
      setAlwaysAllowState(await setAlwaysAllow(next));
    } catch {
      setAlwaysAllowState(previous);
      toast.error("Could not save. Only workspace admins can change this setting.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      const result = await clearChatHistory(confirmText);
      if ("error" in result) {
        toast.error("A chat is still replying. Try again in a moment.");
        return;
      }
      setConfirmText("");
      onHistoryCleared?.();
      toast.success(result.deleted === 1 ? "Deleted 1 chat" : `Deleted ${result.deleted} chats`);
    } catch {
      toast.error("Could not clear chat history");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Page>
        <PageHeader
          icon={<GearIcon size={18} />}
          title="Copilot Settings"
          description="How Copilot runs in this workspace."
        />

        <Section
          title="Provider"
          description="Copilot uses the AI provider set up for your workspace."
          actions={
            <Link href="/dashboard/settings?tab=ai" className={BTN_OUTLINE}>
              Change in AI settings
            </Link>
          }
        >
          <dl className="grid max-w-[560px] grid-cols-[120px_1fr] gap-y-2 text-[13px]">
            <ProviderRow label="Source" value={SOURCE_LABELS[provider.source]} />
            <ProviderRow label="Provider" value={provider.provider ?? "None"} />
            <ProviderRow label="Model" value={provider.model ?? "None"} />
            <ProviderRow
              label="Tools"
              value={provider.supportsTools ? "Can look up and change CRM data" : "Chat only, no CRM tools"}
            />
          </dl>
        </Section>

        <Section
          title="Always allow"
          description="Copilot asks before it changes your data. Turn a tool on to let it run without asking."
        >
          <div className="max-w-[560px]">
            {allowableTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between gap-4 border-b border-divider py-3 first:pt-0 last:border-b-0"
              >
                <span className="text-[14px] text-fg">{tool.label}</span>
                <Switch
                  label={tool.label}
                  checked={alwaysAllow.includes(tool.name)}
                  onCheckedChange={(enabled) => handleToggle(tool.name, enabled)}
                  disabled={isSaving}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-fg-muted">
            Deleting records always needs your approval. Only workspace admins can change this list.
          </p>
        </Section>

        <Section title="Usage today" description="Tokens used by Copilot and other AI features today.">
          <div className="max-w-[560px]">
            <UsageRow label="This workspace" used={usage.orgUsedTokens} limit={usage.orgLimitTokens} />
            <UsageRow
              label="Shared Pulse key, all workspaces"
              used={usage.sharedUsedTokens}
              limit={usage.sharedLimitTokens}
            />
          </div>
          {usage.isGuest && (
            <p className="mt-3 text-[13px] text-fg-muted">
              You are using a guest session, so Copilot runs on the shared key and counts against the shared limit.
            </p>
          )}
        </Section>

        <Section
          title="Clear chat history"
          description="Deletes all of your chats and their messages. Artifacts, memory and tasks are kept."
        >
          <div className="max-w-[560px]">
            <label htmlFor="copilot-clear-confirm" className={LABEL}>
              Type {CLEAR_CONFIRM_TEXT} to confirm
            </label>
            <div className="flex items-center gap-2">
              <input
                id="copilot-clear-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                className={`${FIELD} h-8 max-w-[200px]`}
              />
              <button
                type="button"
                onClick={handleClear}
                disabled={confirmText !== CLEAR_CONFIRM_TEXT || isClearing}
                className={BTN_DANGER}
              >
                Clear chat history
              </button>
            </div>
          </div>
        </Section>
      </Page>
    </div>
  );
}
