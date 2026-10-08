import { useEffect, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';

import { PULSE_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER, PULSE_CHAT_ROUTE_PATH } from 'src/constants/chat-ids';
import { borderColor, buttonStyle } from 'src/front-components/setup/styles';
import { useTheme } from 'src/insights/ui';

type Step = { tool: string; ok: boolean; summary: string };
type Message = { role: 'user' | 'assistant'; content: string; steps?: Step[]; error?: boolean };
type ChatResponse = { ok: boolean; error?: string; reply?: string; steps?: Step[]; model?: string };

const STORAGE_KEY = 'pulse-chat:v1';
const SUGGESTIONS = ['find leads', 'Who are my hottest leads today?', 'How many leads are waiting for review?'];

const load = (): Message[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const save = (messages: Message[]) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)));
  } catch {
    // storage blocked; the chat still works for this visit
  }
};

const TOOL_LABELS: Record<string, string> = {
  list_objects: 'Listed objects',
  describe_object: 'Read fields',
  search_records: 'Searched records',
  get_record: 'Opened a record',
  create_record: 'Created a record',
  update_record: 'Updated a record',
  start_icp: 'Built the ICP',
  find_leads: 'Searched Prospeo',
  qualify_leads: 'Ran the qualifier',
  qualification_status: 'Counted leads',
  enroll_qualified: 'Enrollment',
};

// The Pulse chat page: an AI chat over the CRM that runs on the workspace's own
// AI provider (the AI variables, e.g. llmsrelay), not Twenty's built-in AI.
const PulseChat = () => {
  const theme = useTheme();
  const border = borderColor(theme);
  const [messages, setMessages] = useState<Message[]>(load);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    save(messages);
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const history = next.filter((m) => !m.error).map(({ role, content: c }) => ({ role, content: c }));
      const res = await new RestApiClient().post<ChatResponse>(`/s${PULSE_CHAT_ROUTE_PATH}`, { messages: history });
      if (!res.ok) throw new Error(res.error ?? 'The chat failed');
      if (res.model) setModel(res.model);
      setMessages([...next, { role: 'assistant', content: res.reply ?? '', steps: res.steps }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: err instanceof Error ? err.message : String(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const bubble = (m: Message) => ({
    alignSelf: m.role === 'user' ? ('flex-end' as const) : ('flex-start' as const),
    maxWidth: '85%',
    padding: '8px 12px',
    borderRadius: 10,
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'anywhere' as const,
    fontSize: 14,
    lineHeight: 1.45,
    background: m.role === 'user' ? (theme.dark ? '#312e81' : '#eef2ff') : theme.dark ? '#1f1f1f' : '#f9fafb',
    border: `1px solid ${m.error ? theme.color('red') : border}`,
    color: m.error ? theme.color('red') : theme.text,
  });

  return (
    <div style={{ boxSizing: 'border-box', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'inherit', color: theme.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${border}`, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Pulse chat</span>
        <span style={{ color: theme.muted }}>{model ? `on ${model}` : 'on your own AI'}</span>
        <span style={{ flex: 1 }} />
        <button type="button" style={buttonStyle(theme, busy)} disabled={busy || messages.length === 0} onClick={() => setMessages([])}>
          New chat
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: theme.muted, fontSize: 14 }}>
            <span>Ask about your leads, deals and companies, or say "find leads" to build a fresh ICP and pull new leads.</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" style={buttonStyle(theme, false)} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {m.steps?.length ? (
              <span style={{ fontSize: 12, color: theme.muted }}>
                {m.steps.map((s) => `${s.ok ? '✓' : '✗'} ${TOOL_LABELS[s.tool] ?? s.tool}${s.ok ? '' : `: ${s.summary}`}`).join(' · ')}
              </span>
            ) : null}
            <div style={bubble(m)}>{m.content}</div>
          </div>
        ))}
        {busy ? <span style={{ fontSize: 13, color: theme.muted }}>Working…</span> : null}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${border}` }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          placeholder="Message Pulse…"
          rows={2}
          style={{ ...buttonStyle(theme, false), flex: 1, cursor: 'text', resize: 'none', fontSize: 14, fontFamily: 'inherit' }}
        />
        <button type="submit" style={buttonStyle(theme, busy || !draft.trim())} disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PULSE_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'pulse-chat',
  description: 'AI chat over the CRM on your own AI provider',
  component: PulseChat,
});
