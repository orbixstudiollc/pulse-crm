import { useEffect, useMemo, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { AI_MODELS_ROUTE_PATH } from 'src/constants/sequences-ids';
import type { ModelOption } from 'src/gtm/sequences/ai-models';
import { useTheme } from 'src/insights/ui';
import { borderColor, buttonStyle, sectionTitle } from 'src/front-components/settings/styles';

type AiModelsResult = {
  ok: boolean;
  error?: string;
  provider?: string;
  picked?: string | null;
  variable?: string | null;
  current?: string | null;
  models?: ModelOption[];
};

const call = (body: Record<string, unknown>) => new RestApiClient().post<AiModelsResult>(`/s${AI_MODELS_ROUTE_PATH}`, body);

// Fetch the provider's models and pick the one that writes openers.
export const AiModelSection = () => {
  const theme = useTheme();
  const [status, setStatus] = useState<AiModelsResult | null>(null);
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await call(body);
      if (!res.ok) {
        setError(res.error ?? 'Request failed');
        return null;
      }
      setStatus(res);
      if (res.models) setModels(res.models);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void run({ action: 'status' });
  }, []);

  const select = async (model: string) => {
    const res = await run({ action: 'select', model });
    if (res) enqueueSnackbar({ message: `Openers will now use ${model}`, variant: 'success' });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (models ?? []).filter((m) => !q || m.id.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q));
  }, [models, query]);

  const border = borderColor(theme);
  const button = buttonStyle(theme, busy);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={sectionTitle}>AI model for openers</span>
        <span style={{ fontSize: 13, color: theme.muted }}>
          Pulls the model list from your AI provider (Apps &gt; Pulse GTM &gt; Variables). Picking one here overrides the AI model variable.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
        <span>
          Provider: <b>{status?.provider ?? '…'}</b>
        </span>
        <span>
          Current model: <b>{status?.current ?? 'provider default'}</b>
          {status?.picked ? <span style={{ color: theme.muted }}> (picked here)</span> : status?.variable ? <span style={{ color: theme.muted }}> (from variable)</span> : null}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={button} disabled={busy} onClick={() => void run({ action: 'list' })}>
          {busy ? 'Working…' : models ? 'Refresh models' : 'Fetch models'}
        </button>
        {status?.picked ? (
          <button type="button" style={button} disabled={busy} onClick={() => void run({ action: 'clear' })}>
            Use the variable instead
          </button>
        ) : null}
      </div>

      {error ? <span style={{ color: theme.color('red'), fontSize: 13 }}>{error}</span> : null}

      {models ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${models.length} models`}
            style={{ ...button, cursor: 'text', opacity: 1 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${border}`, borderRadius: 8, maxHeight: 420, overflowY: 'auto' }}>
            {filtered.length === 0 ? <span style={{ padding: 12, fontSize: 13, color: theme.muted }}>No models match.</span> : null}
            {filtered.map((m) => {
              const active = m.id === status?.current;
              return (
                <button
                  type="button"
                  key={m.id}
                  disabled={busy}
                  onClick={() => void select(m.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    border: 'none',
                    borderBottom: `1px solid ${border}`,
                    background: active ? (theme.dark ? '#25253a' : '#eef2ff') : 'transparent',
                    color: theme.text,
                    fontSize: 13,
                    textAlign: 'left',
                    cursor: busy ? 'default' : 'pointer',
                  }}
                >
                  <span style={{ fontFamily: 'monospace' }}>{m.id}</span>
                  <span style={{ color: active ? theme.accent : theme.muted }}>{active ? 'In use' : (m.name ?? '')}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
