import { useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { copyToClipboard, getApplicationVariable } from 'twenty-sdk/front-component';

import { RB2B_ROUTE_PATH, VISITOR_STATUS_ROUTE_PATH } from 'src/constants/insights-ids';
import { trackingSnippet } from 'src/insights/tracking-snippet';
import { useTheme } from 'src/insights/ui';
import { borderColor, buttonStyle, sectionTitle } from 'src/front-components/setup/styles';

type Status =
  | {
      ok: true;
      visitors: number;
      lastDay: number;
      companies: number;
      withLeads: number;
      lastVisitAt: string | null;
      ipLookup: boolean;
      prospeo: boolean;
      leadsPerCompany: number;
      dailyLeadCap: number;
      sequenceName: string;
      sequenceFound: boolean;
      rb2bVisitors: number;
      countries: string;
      outOfRegion: number;
      rb2bKey: string;
    }
  | { ok: false; error: string };

// The website tag (for Google Tag Manager or the page <head>) and whether visitors are coming in.
export const WebsiteTrackingSection = () => {
  const theme = useTheme();
  const [status, setStatus] = useState<Status | null>(null);
  const [copied, setCopied] = useState<'tag' | 'rb2b' | null>(null);

  const endpoint = getApplicationVariable('TRACKING_ENDPOINT_URL')?.trim() || new RestApiClient().resolveUrl('/s/track');
  const snippet = trackingSnippet(endpoint);

  const refresh = async () => {
    try {
      setStatus(await new RestApiClient().post<Status>(`/s${VISITOR_STATUS_ROUTE_PATH}`, {}));
    } catch (err) {
      setStatus({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  };
  useEffect(() => {
    void refresh();
  }, []);

  const rb2bUrl = status?.ok ? `${new RestApiClient().resolveUrl(`/s${RB2B_ROUTE_PATH}`)}?key=${status.rb2bKey}` : null;

  const copy = async (what: 'tag' | 'rb2b') => {
    const text = what === 'tag' ? snippet : rb2bUrl;
    if (!text) return;
    await copyToClipboard(text);
    setCopied(what);
  };

  const check = (done: boolean, text: string) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
      <span style={{ color: done ? theme.color('green') : theme.color('orange') }}>{done ? '✓' : '○'}</span>
      <span>{text}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={sectionTitle}>Website tracking</span>
        <span style={{ fontSize: 13, color: theme.muted }}>
          In Google Tag Manager: Tags &gt; New &gt; Custom HTML, paste the tag below, set the trigger to All Pages, then Submit and Publish.
          Without Tag Manager, paste it before &lt;/head&gt; on every page.
        </span>
      </div>

      <pre
        style={{
          margin: 0,
          padding: 12,
          maxHeight: 160,
          overflow: 'auto',
          fontSize: 11,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          border: `1px solid ${borderColor(theme)}`,
          borderRadius: 6,
          background: theme.dark ? '#141414' : '#f9fafb',
        }}
      >
        {snippet}
      </pre>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={buttonStyle(theme, false)} onClick={() => void copy('tag')}>
          {copied === 'tag' ? 'Copied' : 'Copy tag'}
        </button>
        <button type="button" style={buttonStyle(theme, false)} onClick={() => void refresh()}>
          Refresh status
        </button>
      </div>

      {status?.ok ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {check(status.visitors > 0, status.visitors > 0
            ? `Tag is live: ${status.visitors} visitors, ${status.lastDay} in the last 24 hours${status.lastVisitAt ? `, last ${new Date(status.lastVisitAt).toLocaleString()}` : ''}`
            : 'No visitors yet: install the tag, then open your site once')}
          {check(status.ipLookup, status.ipLookup
            ? `Company lookup on: ${status.companies} visitors matched to a company`
            : 'Company lookup off: add an IPinfo token (Settings > Apps > Pulse GTM > Variables)')}
          {check(status.prospeo && status.leadsPerCompany > 0, status.prospeo && status.leadsPerCompany > 0
            ? `Prospeo adds up to ${status.leadsPerCompany} ICP people per company, ${status.dailyLeadCap} a day at most (${status.withLeads} companies so far)`
            : 'Visitor leads off: set the Prospeo API key and Leads per visiting company')}
          {check(true, `Credits only for visitors from ${status.countries} (${status.outOfRegion} others skipped). Change it in Variables > Visitor countries`)}
          {check(status.sequenceFound, status.sequenceFound
            ? `New visitor leads and form fills go into the "${status.sequenceName}" sequence`
            : `Create a sequence named "${status.sequenceName}" to email visitor leads automatically`)}
          {check(status.rb2bVisitors > 0, status.rb2bVisitors > 0
            ? `RB2B connected: ${status.rb2bVisitors} identified visitors`
            : 'Optional, RB2B: in RB2B go to Integrations > Webhook, paste the webhook URL, and Save')}
          <div>
            <button type="button" style={buttonStyle(theme, false)} onClick={() => void copy('rb2b')}>
              {copied === 'rb2b' ? 'Copied' : 'Copy RB2B webhook URL'}
            </button>
          </div>
        </div>
      ) : status && !status.ok ? (
        <span style={{ color: theme.color('red'), fontSize: 13 }}>{status.error}</span>
      ) : null}
    </div>
  );
};
