import {
  csvRowProblem,
  dedupeNewMailboxes,
  filterWorkspaceUsers,
  mailboxInputFromCsvRow,
  mailboxInputFromDirectoryUser,
  parseMailboxCsv,
  type DirectoryUser,
  type WorkspaceImportFilter,
} from 'src/gtm/mailbox/bulk-import';
import type { MailboxImportStore } from 'src/gtm/mailbox/twenty-repository';

export type ImportSummary = {
  ok: true;
  dryRun: boolean;
  created: string[];
  skippedExisting: string[];
  skippedDuplicate: string[];
  failed: { email?: string; line?: number; error: string }[];
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Same handler serves the AI tool (payload = input) and the HTTP route (payload = request event).
export const toolOrRouteInput = <T extends Record<string, unknown>>(payload: unknown): T => {
  if (!payload || typeof payload !== 'object') return {} as T;
  const p = payload as Record<string, unknown>;
  if ('requestContext' in p && 'body' in p) {
    if (typeof p.body === 'string') {
      try {
        return (JSON.parse(p.body) ?? {}) as T;
      } catch {
        return {} as T;
      }
    }
    return ((p.body as T | null) ?? {}) as T;
  }
  return p as T;
};

export const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : typeof value === 'string'
      ? value.split(/[\s,;]+/).filter(Boolean)
      : [];

// Creates a GOOGLE_DELEGATED mailbox for every active Workspace user that
// matches the filter and is not already a mailbox.
export const importWorkspaceMailboxes = async (input: {
  store: MailboxImportStore;
  listUsers: () => Promise<DirectoryUser[]>;
  filter: WorkspaceImportFilter;
  dryRun?: boolean;
}): Promise<ImportSummary & { listed: number; matched: number }> => {
  const users = await input.listUsers();
  const matched = filterWorkspaceUsers(users, input.filter);
  const plan = dedupeNewMailboxes(matched.map(mailboxInputFromDirectoryUser), await input.store.listMailboxEmails());
  const summary = {
    ok: true as const,
    dryRun: Boolean(input.dryRun),
    listed: users.length,
    matched: matched.length,
    created: [] as string[],
    skippedExisting: plan.skippedExisting,
    skippedDuplicate: plan.skippedDuplicate,
    failed: [] as ImportSummary['failed'],
  };
  for (const mailbox of plan.fresh) {
    if (summary.dryRun) {
      summary.created.push(mailbox.email);
      continue;
    }
    try {
      await input.store.createMailbox(mailbox);
      summary.created.push(mailbox.email);
    } catch (error) {
      summary.failed.push({ email: mailbox.email, error: errorText(error) });
    }
  }
  return summary;
};

// Creates PASSWORD mailboxes from a pasted CSV, sealing each app password.
export const importCsvMailboxes = async (input: {
  store: MailboxImportStore;
  csv: string;
  seal: (password: string) => string;
  dryRun?: boolean;
}): Promise<ImportSummary & { parsed: number }> => {
  const parsed = parseMailboxCsv(input.csv);
  const failed: ImportSummary['failed'] = parsed.errors.map((e) => ({ line: e.line, error: e.message }));
  const usable = parsed.rows.filter((row) => {
    const problem = csvRowProblem(row);
    if (problem) failed.push({ line: row.line, email: row.email, error: problem });
    return !problem;
  });
  const plan = dedupeNewMailboxes(usable, await input.store.listMailboxEmails());
  const summary = {
    ok: true as const,
    dryRun: Boolean(input.dryRun),
    parsed: parsed.rows.length,
    created: [] as string[],
    skippedExisting: plan.skippedExisting,
    skippedDuplicate: plan.skippedDuplicate,
    failed,
  };
  for (const row of plan.fresh) {
    if (summary.dryRun) {
      summary.created.push(row.email);
      continue;
    }
    try {
      await input.store.createMailbox(mailboxInputFromCsvRow(row, input.seal(row.password)));
      summary.created.push(row.email);
    } catch (error) {
      summary.failed.push({ line: row.line, email: row.email, error: errorText(error) });
    }
  }
  return summary;
};
