"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { getTwentyIntegrationState, saveTwentyConnection, revokeTwentyConnection, saveTwentyRelayConfiguration, recordTwentyCutover } from "@/lib/actions/twenty-connections";
import type { TwentyConnectionMetadata, TwentyCutoverAudit } from "@/lib/twenty/types";

export function TwentySettings() {
  const [connection, setConnection] = useState<TwentyConnectionMetadata | null>(null);
  const [url, setUrl] = useState("https://orbix-sales.twenty.com");
  const [key, setKey] = useState("");
  const [relayKey, setRelayKey] = useState("");
  const [model, setModel] = useState("");
  const [fastModel, setFastModel] = useState("");
  const [relayConfigured, setRelayConfigured] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [coveredObjects, setCoveredObjects] = useState("person, company, mailbox");
  const [triggerEvidence, setTriggerEvidence] = useState("[]");
  const [coverageEvidence, setCoverageEvidence] = useState("");
  const [probeRecordId, setProbeRecordId] = useState("");
  const [probeEvidence, setProbeEvidence] = useState("");
  const [cutoverVerified, setCutoverVerified] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await getTwentyIntegrationState();
      if (cancelled) return;
      if (result.ok) {
        setConnection(result.data.connection);
        if (result.data.connection) setUrl(result.data.connection.workspace_url);
        setModel(result.data.relay.model); setFastModel(result.data.relay.fastModel); setRelayConfigured(result.data.relay.configured);
      } else setError(result.error);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return <section className="rounded-lg border border-line bg-surface p-5 space-y-5" aria-labelledby="twenty-settings-heading">
    <div>
      <h3 id="twenty-settings-heading" className="font-semibold text-fg">Twenty CRM + LLMsRelay</h3>
      <p className="mt-1 text-sm text-fg-secondary">Use Twenty sales records in Pulse Copilot. Owner and admin access is required. Every record change and email send needs approval.</p>
    </div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-fg-secondary">{notice}</p>}
    {loading ? <p role="status" className="text-sm text-fg-muted">Loading connection…</p> : <>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault(); setError(""); setNotice("");
        startTransition(async () => {
          const result = await saveTwentyConnection({ workspaceUrl: url, apiKey: key || undefined });
          setKey("");
          if (!result.ok) { setError(result.error); return; }
          setConnection(result.data); setUrl(result.data.workspace_url);
          setNotice("Twenty connection verified. Writes remain disabled until the trigger cutover is reviewed.");
        });
      }}>
        <Input id="twenty-workspace-url" label="Twenty workspace URL" type="url" value={url} onChange={event => setUrl(event.target.value)} required disabled={pending} />
        <Input id="twenty-api-key" label="Twenty API key" type="password" autoComplete="new-password" value={key} onChange={event => setKey(event.target.value)} placeholder={connection?.status === "verified" ? "Saved securely; leave blank to keep" : "Enter a workspace API key"} helperText="Create a restricted sales-data API key in Twenty → Settings → MCP & APIs. Keys are encrypted and never shown again." disabled={pending} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>Verify and save connection</Button>
          {connection?.status === "verified" && <Button type="button" variant="secondary" disabled={pending} onClick={() => {
            setError(""); setNotice("");
            startTransition(async () => {
              const result = await revokeTwentyConnection(connection.id, connection.revision);
              if (!result.ok) { setError(result.error); return; }
              setConnection({ ...connection, status: "revoked", writes_enabled: false, revision: connection.revision + 1 });
              setNotice("Connection revoked. Existing conversations and approvals cannot execute Twenty actions.");
            });
          }}>Disconnect</Button>}
        </div>
      </form>
      {connection && <div className="rounded-md bg-subtle p-3 text-sm text-fg-secondary space-y-1">
        <p>Connection: <span className="font-medium text-fg">{connection.status}</span></p>
        <p>Conditional updates: {connection.cas_verified ? "schema verified" : "unsupported; writes disabled"}</p>
        <p>Writes: {connection.writes_enabled ? "approval required; cutover recorded" : "disabled pending native-trigger cutover"}</p>
        <p>Scheduled AI: requires explicit workflow activation and a monthly token cap.</p>
      </div>}
      {connection?.status === "verified" && !connection.writes_enabled && <details className="border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-medium text-fg">Record reviewed cutover evidence</summary>
        <p className="mt-3 text-sm text-fg-secondary">Complete the deployment cutover checklist first. Review every native workflow and installed app trigger, pause overlapping actions, and run the fresh/stale conditional-update probe in the approved test workspace. Recording evidence enables approved writes for the listed objects.</p>
        <form className="mt-3 space-y-3" onSubmit={event => {
          event.preventDefault(); setError(""); setNotice("");
          let nativeTriggers: TwentyCutoverAudit["nativeTriggers"];
          try { nativeTriggers = JSON.parse(triggerEvidence); }
          catch { setError("Trigger evidence must be a JSON array."); return; }
          startTransition(async () => {
            const result = await recordTwentyCutover({ connectionId: connection.id, revision: connection.revision, coveredObjects: coveredObjects.split(",").map(value => value.trim()).filter(Boolean), nativeTriggers, coverageEvidence, verifiedNoUnexpectedEffects: cutoverVerified, conditionalUpdateEvidence: { recordId: probeRecordId.trim(), returnedOne: cutoverVerified, staleRejected: cutoverVerified, evidence: probeEvidence } });
            if (!result.ok) { setError(result.error); return; }
            setConnection(result.data); setCutoverVerified(false); setNotice("Cutover evidence recorded. Every Twenty write and email still requires an individual approval.");
          });
        }}>
          <Input id="twenty-covered-objects" label="Audited object names (comma-separated)" value={coveredObjects} onChange={event => setCoveredObjects(event.target.value)} required disabled={pending} />
          <Textarea id="twenty-trigger-evidence" label="Native trigger resolutions" value={triggerEvidence} onChange={event => setTriggerEvidence(event.target.value)} helperText={'JSON array: [{"id":"exact-trigger-id","name":"Trigger name","resolution":"paused","evidence":"Verification details"}]. Use non_overlapping only after verifying the trigger cannot act on the approved objects.'} rows={4} required disabled={pending} />
          <Textarea id="twenty-coverage-evidence" label="Complete audit coverage and effect verification" value={coverageEvidence} onChange={event => setCoverageEvidence(event.target.value)} rows={3} required disabled={pending} />
          <Input id="twenty-probe-record" label="Conditional-update test record ID" value={probeRecordId} onChange={event => setProbeRecordId(event.target.value)} required disabled={pending} />
          <Textarea id="twenty-probe-evidence" label="Fresh update and stale rejection evidence" value={probeEvidence} onChange={event => setProbeEvidence(event.target.value)} rows={3} required disabled={pending} />
          <label className="flex items-start gap-2 text-sm text-fg-secondary">
            <input type="checkbox" checked={cutoverVerified} onChange={event => setCutoverVerified(event.target.checked)} disabled={pending} required className="mt-1" />
            <span>I reviewed the complete trigger inventory, verified no unintended actions, confirmed exactly one fresh update, and confirmed the stale version changes zero records.</span>
          </label>
          <Button type="submit" variant="secondary" disabled={!cutoverVerified} loading={pending}>Record evidence and enable approval-controlled writes</Button>
        </form>
      </details>}
      <form className="border-t border-line pt-4 space-y-3" onSubmit={event => {
        event.preventDefault(); setError(""); setNotice("");
        startTransition(async () => {
          const result = await saveTwentyRelayConfiguration({ apiKey: relayKey || undefined, model, fastModel });
          setRelayKey("");
          if (!result.ok) { setError(result.error); return; }
          setRelayConfigured(true); setNotice("LLMsRelay key and both models verified and saved. Manual Twenty Copilot requests are ready once the connection is verified.");
        });
      }}>
        <h4 className="text-sm font-semibold text-fg">LLMsRelay models</h4>
        <p className="text-sm text-fg-secondary">Twenty AI uses GPT through LLMsRelay. Model verification reads the key’s catalog without running inference.</p>
        <Input id="twenty-relay-key" label="LLMsRelay API key" type="password" autoComplete="new-password" value={relayKey} onChange={event => setRelayKey(event.target.value)} placeholder={relayConfigured ? "Saved securely; leave blank to keep" : "Enter a GPT/Codex LLMsRelay key"} disabled={pending} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input id="twenty-main-model" label="Main model ID" value={model} onChange={event => setModel(event.target.value)} placeholder="gpt-6.1-sol" required disabled={pending} />
          <Input id="twenty-fast-model" label="Fast model ID" value={fastModel} onChange={event => setFastModel(event.target.value)} placeholder="gpt-5.6-sol" required disabled={pending} />
        </div>
        <p className="text-xs text-fg-muted">These settings reuse Pulse’s custom AI configuration. Pulse’s selected provider is unchanged.</p>
        <Button type="submit" variant="secondary" loading={pending}>Verify and save models</Button>
      </form>
    </>}
  </section>;
}
