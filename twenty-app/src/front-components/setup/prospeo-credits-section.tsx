import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { PROSPEO_CREDITS_ROUTE_PATH } from 'src/constants/leadfinder-ids';
import type { ProspeoAccountInfo } from 'src/gtm/prospeo/api';
import { useTheme } from 'src/insights/ui';
import { buttonStyle, sectionTitle } from 'src/front-components/setup/styles';

type CreditsResult = ({ ok: true } & ProspeoAccountInfo) | { ok: false; error: string };

const formatNumber = (value: number | null) => (value === null ? '–' : value.toLocaleString());

// Prospeo credits left, checked when the page opens and on Refresh (free, costs no credits).
export const ProspeoCreditsSection = () => {
  const theme = useTheme();
  const [info, setInfo] = useState<ProspeoAccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await new RestApiClient().post<CreditsResult>(`/s${PROSPEO_CREDITS_ROUTE_PATH}`, {});
      if (res.ok) setInfo(res);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const low = info?.remainingCredits !== null && info?.remainingCredits !== undefined && info.remainingCredits < 100;
  const renewal = info?.renewalDate ? new Date(info.renewalDate.replace(' ', 'T')) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={sectionTitle}>Prospeo credits</span>
        <span style={{ fontSize: 13, color: theme.muted }}>
          A search costs 1 credit per page of 25 people; an email lookup costs 1 (10 with mobile). Checking here is free.
        </span>
      </div>

      {info ? (
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 13 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: theme.muted }}>Credits left</span>
            <span style={{ fontSize: 24, fontWeight: 600, color: low ? theme.color('red') : theme.text }}>{formatNumber(info.remainingCredits)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: theme.muted }}>Used this period</span>
            <span style={{ fontSize: 24, fontWeight: 600 }}>{formatNumber(info.usedCredits)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: theme.muted }}>Plan</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{info.plan ?? '–'}</span>
            {renewal && !Number.isNaN(renewal.getTime()) ? (
              <span style={{ color: theme.muted }}>
                Renews {renewal.toLocaleDateString()}
                {info.renewalInDays !== null ? ` (in ${info.renewalInDays} days)` : ''}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <span style={{ color: theme.color('red'), fontSize: 13 }}>{error}</span> : null}

      <div>
        <button type="button" style={buttonStyle(theme, busy)} disabled={busy} onClick={() => void refresh()}>
          {busy ? 'Checking…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
};
