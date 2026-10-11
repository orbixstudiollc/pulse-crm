"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getTwentyWorkflowsAction, saveTwentyWorkflowAction } from "@/lib/twenty/workflows/actions";
import { WORKFLOW_KINDS, type WorkflowKind } from "@/lib/twenty/workflows/types";
import { QuickLead } from "./QuickLead";

type State = Awaited<ReturnType<typeof getTwentyWorkflowsAction>>;
const TITLES: Record<WorkflowKind, string> = { company_link: "Link business email domains to companies", mailbox_ready: "Draft mailbox readiness notifications", qualification: "Prepare AI lead qualification" };

export function TwentyWorkflows({ connectionId, onProposed }: { connectionId?: string; onProposed?: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [cap, setCap] = useState("0");
  const [senderId, setSenderId] = useState("");
  const [sender, setSender] = useState("");
  const [recipients, setRecipients] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await getTwentyWorkflowsAction(connectionId);
      setState(result); setError(false); setCap(String(result.tokenCap ?? 0));
      const config = result.workflows.find((workflow) => workflow.kind === "mailbox_ready")?.config as Record<string, unknown> | undefined;
      if (config) {
        setSenderId(String(config.connectedAccountId ?? "")); setSender(String(config.fromHandle ?? ""));
        setRecipients(Array.isArray(config.recipients) ? config.recipients.join(", ") : "");
      }
    } catch { setError(true); }
  }, [connectionId]);
  useEffect(() => { let cancelled = false; startTransition(async () => { if (!cancelled) await refresh(); }); return () => { cancelled = true; }; }, [refresh]);
  function save(kind: WorkflowKind, enabled: boolean) {
    startTransition(async () => {
      try {
        if (!state) return;
        await saveTwentyWorkflowAction({ connectionId: state.connectionId, kind, enabled, monthlyTokenCap: Number(cap),
          ...(kind === "mailbox_ready" ? { ...(senderId ? { connectedAccountId: senderId } : {}), ...(sender ? { fromHandle: sender } : {}), recipients: recipients.split(",").map((value) => value.trim()).filter(Boolean) } : {}),
        });
        await refresh(); toast.success(enabled ? "Workflow enabled; a new baseline will be initialized" : "Workflow paused");
      } catch { toast.error("Could not save workflow. Check the token cap and sender settings."); }
    });
  }
  if (error) return <div role="alert" className="p-4 text-sm text-fg-muted">Workflow settings could not be loaded. <button type="button" onClick={() => startTransition(refresh)} className="underline">Retry</button></div>;
  if (!state) return <p role="status" className="p-4 text-sm text-fg-muted">Loading Twenty workflows…</p>;
  return (
    <div className="space-y-4">
      <QuickLead connectionId={state.connectionId} onProposed={() => { startTransition(refresh); onProposed?.(); }} />
      <section className="rounded-xl border border-divider p-4" aria-label="Twenty workflows">
        <h3 className="font-medium text-fg">Sales workflows</h3>
        <p className="mt-1 text-sm text-fg-muted">All workflows start paused. Enabled workflows watch future changes every five minutes and prepare actions for approval.</p>
        {!state.writesEnabled && <p className="mt-2 text-sm text-fg-muted">CRM writes remain locked until the native trigger cutover is verified.</p>}
        <label className="mt-4 grid gap-1 text-sm text-fg-muted">Monthly scheduled AI token cap
          <input type="number" min="0" max="100000000" step="1" value={cap} onChange={(event) => setCap(event.target.value)} className="rounded-lg border border-divider bg-surface px-3 py-2 text-fg" />
        </label>
        <p className="mt-1 text-xs text-fg-muted">{state.tokensUsed.toLocaleString()} tokens charged this month. A cap of zero disables scheduled AI.</p>
        <fieldset className="mt-4 grid gap-2 rounded-lg border border-divider p-3">
          <legend className="px-1 text-sm text-fg-muted">Mailbox readiness notification sender</legend>
          <label className="grid gap-1 text-xs text-fg-muted">Sender<select value={senderId} onChange={(event) => { const selected = state.accounts.find((account) => account.id === event.target.value); setSenderId(selected?.id ?? ""); setSender(selected?.handle ?? ""); }} className="rounded border border-divider bg-surface px-2 py-2 text-sm text-fg"><option value="">Select a connected mailbox</option>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.handle}</option>)}</select></label>
          {!state.accounts.length && <p className="text-xs text-fg-muted">No connected mailbox could be loaded. Check Twenty mailbox access, then refresh.</p>}
          <label className="grid gap-1 text-xs text-fg-muted">Recipients, separated by commas<input value={recipients} onChange={(event) => setRecipients(event.target.value)} className="rounded border border-divider bg-surface px-2 py-2 text-sm text-fg" /></label>
        </fieldset>
        <div className="mt-3 divide-y divide-divider">{WORKFLOW_KINDS.map((kind) => {
          const workflow = state.workflows.find((entry) => entry.kind === kind);
          const enabled = workflow?.enabled === true;
          return <div key={kind} className="flex items-center justify-between gap-3 py-3">
            <div><p className="text-sm text-fg">{TITLES[kind]}</p><p className="text-xs text-fg-muted">{enabled ? "Enabled" : "Paused"}{workflow?.last_error ? " · Attention required" : ""}</p></div>
            <button type="button" disabled={pending} onClick={() => save(kind, !enabled)} className="rounded-lg border border-divider px-3 py-2 text-sm text-fg disabled:opacity-50">{enabled ? "Pause" : "Enable"}</button>
          </div>;
        })}</div>
        <button type="button" disabled={pending} onClick={() => save("qualification", state.workflows.some((entry) => entry.kind === "qualification" && entry.enabled))} className="mt-2 rounded-lg border border-divider px-3 py-2 text-sm text-fg disabled:opacity-50">Save token cap</button>
      </section>
      <section className="rounded-xl border border-divider p-4" aria-label="Recent workflow jobs">
        <div className="flex justify-between gap-2"><h3 className="font-medium text-fg">Recent jobs</h3><button type="button" disabled={pending} onClick={() => startTransition(refresh)} className="text-sm text-fg-muted underline">Refresh</button></div>
        {state.jobs.length ? <ul className="mt-2 divide-y divide-divider">{state.jobs.map((job) => <li key={String(job.id)} className="flex justify-between gap-3 py-2 text-sm"><span className="text-fg">{String(job.kind).replaceAll("_", " ")}</span><span className="text-fg-muted">{String(job.status).replaceAll("_", " ")}</span></li>)}</ul> : <p className="mt-2 text-sm text-fg-muted">No jobs yet.</p>}
      </section>
    </div>
  );
}
