import { useEffect, useMemo, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  ENROLL_QUALIFIED_ROUTE_PATH,
  IMPORT_LEADS_ROUTE_PATH,
  QUALIFICATION_STATUS_ROUTE_PATH,
  QUALIFY_LEADS_ROUTE_PATH,
} from 'src/constants/qualify-ids';
import { borderColor, buttonStyle, sectionTitle } from 'src/front-components/setup/styles';
import { LEAD_COLUMNS, parseLeadFile, type LeadColumn } from 'src/gtm/qualify/columns';
import { QUALIFICATION_STATUSES } from 'src/gtm/qualify/values';
import { useTheme } from 'src/insights/ui';

const CHUNK = 200;

type Status = { ok: boolean; error?: string; counts?: Record<string, number>; tools?: { firecrawl: boolean; spider?: boolean; jev: boolean; prospeo: boolean } };
type ImportTotals = { created: number; companiesCreated: number; skippedExisting: number; skippedDuplicate: number; failed: number };
type Named = { id: string; name?: string | null };

const websiteReader = (tools: NonNullable<Status['tools']>) =>
  tools.firecrawl && tools.spider
    ? 'Firecrawl and Spider, taking turns'
    : tools.firecrawl
      ? 'Firecrawl'
      : tools.spider
        ? 'Spider'
        : 'direct fetch (add a Firecrawl or Spider API key for better coverage)';

const post = <T,>(path: string, body: Record<string, unknown>) => new RestApiClient().post<T>(`/s${path}`, body);

const list = async (object: string): Promise<Named[]> => {
  const res = await new RestApiClient().get<{ data?: Record<string, Named[]> }>(`/rest/${object}`, { query: { limit: 100 } });
  return res.data?.[object] ?? [];
};

// Paste a lead file, check the column mapping, import it in chunks; then
// watch the qualifier's progress and enroll the Qualified leads.
export const LeadQualificationSection = () => {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [mapping, setMapping] = useState<(LeadColumn | null)[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [totals, setTotals] = useState<ImportTotals | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [sequences, setSequences] = useState<Named[]>([]);
  const [campaigns, setCampaigns] = useState<Named[]>([]);
  const [sequenceId, setSequenceId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => (text.trim() ? parseLeadFile(text, mapping ?? undefined) : null), [text, mapping]);

  const refresh = async () => {
    try {
      setStatus(await post<Status>(QUALIFICATION_STATUS_ROUTE_PATH, {}));
    } catch (err) {
      setStatus({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  useEffect(() => {
    void refresh();
    void list('sequences').then(setSequences).catch(() => undefined);
    void list('campaigns').then(setCampaigns).catch(() => undefined);
  }, []);

  const runImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setError(null);
    const sum: ImportTotals = { created: 0, companiesCreated: 0, skippedExisting: 0, skippedDuplicate: 0, failed: 0 };
    try {
      for (let i = 0; i < parsed.rows.length; i += CHUNK) {
        setProgress(`Importing ${Math.min(i + CHUNK, parsed.rows.length)} of ${parsed.rows.length}…`);
        const res = await post<{ ok: boolean; error?: string } & Partial<ImportTotals> & { failed?: unknown[] }>(IMPORT_LEADS_ROUTE_PATH, {
          rows: parsed.rows.slice(i, i + CHUNK),
        });
        if (!res.ok) throw new Error(res.error ?? 'Import failed');
        sum.created += res.created ?? 0;
        sum.companiesCreated += res.companiesCreated ?? 0;
        sum.skippedExisting += res.skippedExisting ?? 0;
        sum.skippedDuplicate += res.skippedDuplicate ?? 0;
        sum.failed += Array.isArray(res.failed) ? res.failed.length : 0;
        setTotals({ ...sum });
      }
      setText('');
      setMapping(null);
      enqueueSnackbar({ message: `Imported ${sum.created} leads; qualification starts within 5 minutes`, variant: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
      setBusy(false);
      void refresh();
    }
  };

  const runNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ ok: boolean; error?: string; peopleProcessed?: number; qualified?: number; review?: number; rejected?: number }>(QUALIFY_LEADS_ROUTE_PATH, {});
      if (!res.ok) throw new Error(res.error ?? 'Qualifier failed');
      enqueueSnackbar({ message: `Qualified ${res.qualified ?? 0}, review ${res.review ?? 0}, rejected ${res.rejected ?? 0}`, variant: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const enroll = async (dryRun: boolean) => {
    if (!sequenceId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ ok: boolean; error?: string; eligible?: number; enrolled?: number; skipped?: unknown[] }>(ENROLL_QUALIFIED_ROUTE_PATH, {
        sequenceId,
        campaignId: campaignId || undefined,
        dryRun,
      });
      if (!res.ok) throw new Error(res.error ?? 'Enroll failed');
      enqueueSnackbar({
        message: dryRun ? `${res.eligible ?? 0} leads ready to enroll (${res.skipped?.length ?? 0} held back)` : `Enrolled ${res.enrolled ?? 0} leads`,
        variant: 'success',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const border = borderColor(theme);
  const button = buttonStyle(theme, busy);
  const input = { ...buttonStyle(theme, false), cursor: 'pointer' as const };
  const counts = status?.counts;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={sectionTitle}>Import and qualify leads</span>
        <span style={{ fontSize: 13, color: theme.muted }}>
          Open the lead file (CSV, or copy all rows from Excel or Google Sheets) and paste it here with its header row. Check the mapping, then
          import. Every few minutes the qualifier reads each company's website, classifies the company and the title against the active ICP,
          verifies the email and sorts each lead into Qualified, Review or Rejected. Review leads are in the Lead review list.
        </span>
      </div>

      {counts ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          {QUALIFICATION_STATUSES.map((s) => (
            <span key={s.value}>
              {s.label}: <b>{counts[s.value] ?? 0}</b>
            </span>
          ))}
        </div>
      ) : status?.error ? (
        <span style={{ fontSize: 13, color: theme.color('red') }}>{status.error}</span>
      ) : null}
      {status?.tools ? (
        <span style={{ fontSize: 12, color: theme.muted }}>
          Website reader: {websiteReader(status.tools)} · Bulk classifier:{' '}
          {status.tools.jev ? 'Jev via OpenRouter' : 'your AI model (add an OpenRouter API key to use Jev)'} · Email check:{' '}
          {status.tools.prospeo ? 'Prospeo' : 'off (no Prospeo key)'}
        </span>
      ) : null}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMapping(null);
          setTotals(null);
        }}
        placeholder={'First Name,Last Name,Title,Company,Email,Email Status,Website,# Employees,Country\nAnn,Lee,Founder,Bright Agency,ann@bright.co,Verified,bright.co,24,United States'}
        rows={6}
        spellCheck={false}
        style={{ ...buttonStyle(theme, false), cursor: 'text', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
      />

      {parsed && parsed.headers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, border: `1px solid ${border}`, borderRadius: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>
            {parsed.rows.length} leads read
            {parsed.unusable.length ? `, ${parsed.unusable.length} rows skipped (no email, LinkedIn or name)` : ''}
          </span>
          {parsed.headers.map((h, col) => (
            <div key={`${h}-${col}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h || `(column ${col + 1})`}</span>
              <select
                value={parsed.mapping[col] ?? ''}
                disabled={busy}
                onChange={(e) => {
                  const next = [...parsed.mapping];
                  next[col] = (e.target.value || null) as LeadColumn | null;
                  setMapping(next);
                }}
                style={input}
              >
                <option value="">Don't import</option>
                {LEAD_COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span style={{ color: theme.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parsed.rows[0]?.[parsed.mapping[col] as LeadColumn] ?? ''}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" style={button} disabled={busy || parsed.rows.length === 0} onClick={() => void runImport()}>
              {progress ?? `Import ${parsed.rows.length} leads`}
            </button>
          </div>
        </div>
      ) : null}

      {totals ? (
        <span style={{ fontSize: 13 }}>
          Created {totals.created} people and {totals.companiesCreated} companies. Already in the CRM: {totals.skippedExisting}. Listed twice: {totals.skippedDuplicate}.
          {totals.failed ? ` Failed: ${totals.failed}.` : ''}
        </span>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={button} disabled={busy} onClick={() => void runNow()}>
          Qualify next batch now
        </button>
        <button type="button" style={button} disabled={busy} onClick={() => void refresh()}>
          Refresh counts
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
        <span>Enroll Qualified leads in</span>
        <select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} style={input} disabled={busy}>
          <option value="">Pick a sequence</option>
          {sequences.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.id}
            </option>
          ))}
        </select>
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={input} disabled={busy}>
          <option value="">No campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? c.id}
            </option>
          ))}
        </select>
        <button type="button" style={buttonStyle(theme, busy || !sequenceId)} disabled={busy || !sequenceId} onClick={() => void enroll(true)}>
          Count
        </button>
        <button type="button" style={buttonStyle(theme, busy || !sequenceId)} disabled={busy || !sequenceId} onClick={() => void enroll(false)}>
          Enroll
        </button>
      </div>

      {error ? <span style={{ color: theme.color('red'), fontSize: 13 }}>{error}</span> : null}
    </div>
  );
};
