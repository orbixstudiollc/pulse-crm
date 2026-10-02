import { useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { MAILBOX_IMPORT_CSV_ROUTE_PATH } from 'src/constants/mailbox-ids';
import { borderColor, buttonStyle, sectionTitle } from 'src/front-components/setup/styles';
import { useTheme } from 'src/insights/ui';

type ImportResult = {
  ok: boolean;
  error?: string;
  dryRun?: boolean;
  parsed?: number;
  created?: string[];
  delegated?: string[];
  switched?: string[];
  signInOk?: string[];
  skippedExisting?: string[];
  skippedDuplicate?: string[];
  failed?: { email?: string; line?: number; error: string }[];
};

// Paste rows copied from a spreadsheet (or a CSV) to add many mailboxes at once.
// "Check" is a dry run; "Add mailboxes" encrypts each password and creates them.
export const MailboxImportSection = () => {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const submit = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await new RestApiClient().post<ImportResult>(`/s${MAILBOX_IMPORT_CSV_ROUTE_PATH}`, { csv: text, dryRun });
      setResult(res);
      if (res.ok && !dryRun) {
        setText('');
        const switched = res.switched?.length ?? 0;
        enqueueSnackbar({
          message: `Added ${res.created?.length ?? 0} mailboxes${switched ? `, moved ${switched} to Google sign-in` : ''}`,
          variant: 'success',
        });
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const button = buttonStyle(theme, busy || !text.trim());
  const list = (label: string, items: string[] | undefined) =>
    items && items.length > 0 ? (
      <span>
        {label} ({items.length}): {items.join(', ')}
      </span>
    ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={sectionTitle}>Add mailboxes</span>
        <span style={{ fontSize: 13, color: theme.muted }}>
          Copy the rows from your sheet and paste them here. Recognised columns: email, password (or app password), name or
          first/last name, provider, SMTP host/port, IMAP host/port. Gmail and Outlook need email and app password. Google
          Workspace needs only the email once the Google service account key is set (no passwords). Check first: it also tests
          the Google sign-in for each address. New mailboxes start warming up.
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'email\tapp password\tname\nann@gmail.com\tabcd efgh ijkl mnop\tAnn Lee'}
        rows={8}
        spellCheck={false}
        style={{ ...buttonStyle(theme, false), cursor: 'text', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={button} disabled={busy || !text.trim()} onClick={() => void submit(true)}>
          {busy ? 'Working…' : 'Check'}
        </button>
        <button type="button" style={button} disabled={busy || !text.trim()} onClick={() => void submit(false)}>
          Add mailboxes
        </button>
      </div>
      {result ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: 12,
            fontSize: 13,
            border: `1px solid ${borderColor(theme)}`,
            borderRadius: 8,
            wordBreak: 'break-word',
          }}
        >
          {!result.ok ? (
            <span style={{ color: theme.color('red') }}>{result.error ?? 'Import failed'}</span>
          ) : (
            <>
              <span style={{ fontWeight: 600 }}>
                {result.dryRun ? `Check: ${result.created?.length ?? 0} would be added` : `Added ${result.created?.length ?? 0}`}
                {result.switched?.length ? `, ${result.switched.length} ${result.dryRun ? 'would move' : 'moved'} to Google sign-in` : ''}
                {` of ${result.parsed ?? 0} rows read`}
              </span>
              {list(result.dryRun ? 'Ready' : 'Added', result.created)}
              {list('Google sign-in without password', result.delegated)}
              {list(result.dryRun ? 'Already in Twenty, would move to Google sign-in without password' : 'Moved to Google sign-in without password', result.switched)}
              {list('Already in Twenty, Google sign-in works', result.signInOk)}
              {list('Already in Twenty', result.skippedExisting)}
              {list('Listed twice', result.skippedDuplicate)}
              {result.failed?.map((f, i) => (
                <span key={i} style={{ color: theme.color('red') }}>
                  {f.line ? `Row ${f.line}` : 'Row'}
                  {f.email ? ` (${f.email})` : ''}: {f.error}
                </span>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
