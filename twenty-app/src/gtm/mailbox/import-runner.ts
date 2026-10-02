import {
  csvRowProblem,
  dedupeNewMailboxes,
  filterWorkspaceUsers,
  mailboxInputFromCsvRow,
  mailboxInputFromDirectoryUser,
  normalizeEmail,
  parseMailboxCsv,
  type DirectoryUser,
  type WorkspaceImportFilter,
} from 'src/gtm/mailbox/bulk-import';
import type { MailboxImportStore } from 'src/gtm/mailbox/twenty-repository';
import type { MailboxProvider } from 'src/gtm/mailbox/values';

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
  const existing = (await input.store.listMailboxes()).map((mailbox) => mailbox.email);
  const plan = dedupeNewMailboxes(matched.map(mailboxInputFromDirectoryUser), existing);
  const summary = {
    ok: true as const,
    dryRun: Boolean(input.dryRun),
    listed: users.length,
    matched: matched.length,
    created: [] as string[],
    delegated: [] as string[],
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
  // Finds the provider of a custom domain (MX lookup), so Workspace and
  // Microsoft 365 addresses need no host columns.
  providerForDomain?: (domain: string) => Promise<MailboxProvider | null>;
  // Set when a Google service account is configured: Google rows may leave the
  // password empty and sign in through domain-wide delegation. The dry run
  // mints a token per mailbox to prove each domain has authorised the client.
  delegation?: { verify: (email: string) => Promise<void> };
}): Promise<ImportSummary & { parsed: number; delegated: string[]; switched: string[]; signInOk: string[] }> => {
  const parsed = parseMailboxCsv(input.csv, { passwordOptional: true });
  if (input.providerForDomain) {
    const lookups = new Map<string, Promise<MailboxProvider | null>>();
    for (const row of parsed.rows) {
      if (row.provider || row.smtpHost) continue;
      const domain = row.email.slice(row.email.lastIndexOf('@') + 1);
      if (!lookups.has(domain)) lookups.set(domain, input.providerForDomain(domain).catch(() => null));
      row.provider = await lookups.get(domain)!;
    }
  }
  const failed: ImportSummary['failed'] = parsed.errors.map((e) => ({ line: e.line, error: e.message }));
  const usable = parsed.rows.filter((row) => {
    const problem = row.password
      ? csvRowProblem(row)
      : row.provider !== 'GOOGLE'
        ? `Missing app password for ${row.email}`
        : !input.delegation
          ? `Missing app password for ${row.email}. For Google Workspace without passwords, set the Google service account key first.`
          : null;
    if (problem) failed.push({ line: row.line, email: row.email, error: problem });
    return !problem;
  });
  const existing = await input.store.listMailboxes();
  const plan = dedupeNewMailboxes(usable, existing.map((mailbox) => mailbox.email));
  const summary = {
    ok: true as const,
    dryRun: Boolean(input.dryRun),
    parsed: parsed.rows.length,
    created: [] as string[],
    delegated: [] as string[],
    switched: [] as string[],
    signInOk: [] as string[],
    skippedExisting: [] as string[],
    skippedDuplicate: plan.skippedDuplicate,
    failed,
  };

  // A Google address pasted again without a password, already stored with a
  // password (which Google refuses for Workspace accounts), moves onto
  // delegation: the stored password and any typed-in hosts are dropped (Google
  // defaults apply) and the old error is cleared.
  const byEmail = new Map(existing.map((mailbox) => [normalizeEmail(mailbox.email), mailbox]));
  const rowByEmail = new Map(usable.map((row) => [normalizeEmail(row.email), row]));
  for (const email of plan.skippedExisting) {
    const mailbox = byEmail.get(email);
    const row = rowByEmail.get(email);
    // Passwordless rows only got this far if MX says Google and delegation is set.
    const passwordless = row && !row.password && mailbox;
    // Already on delegation: Check still tests the sign-in, so a domain that
    // has not authorised the client yet shows up red.
    if (passwordless && mailbox.authType === 'GOOGLE_DELEGATED' && summary.dryRun) {
      try {
        await input.delegation!.verify(email);
        summary.signInOk.push(email);
      } catch (error) {
        summary.failed.push({ line: row.line, email, error: errorText(error) });
      }
      continue;
    }
    if (!passwordless || mailbox.authType === 'GOOGLE_DELEGATED') {
      summary.skippedExisting.push(email);
      continue;
    }
    try {
      if (summary.dryRun) await input.delegation!.verify(email);
      else
        await input.store.updateMailbox(mailbox.id, {
          provider: 'GOOGLE',
          authType: 'GOOGLE_DELEGATED',
          credentialCiphertext: null,
          username: null,
          smtpHost: null,
          smtpPort: null,
          smtpSecure: null,
          imapHost: null,
          imapPort: null,
          lastError: null,
        });
      summary.switched.push(email);
    } catch (error) {
      summary.failed.push({ line: row.line, email, error: errorText(error) });
    }
  }
  for (const row of plan.fresh) {
    try {
      if (summary.dryRun) {
        if (!row.password) await input.delegation!.verify(row.email);
      } else {
        await input.store.createMailbox(mailboxInputFromCsvRow(row, row.password ? input.seal(row.password) : null));
      }
      summary.created.push(row.email);
      if (!row.password) summary.delegated.push(row.email);
    } catch (error) {
      summary.failed.push({ line: row.line, email: row.email, error: errorText(error) });
    }
  }
  return summary;
};
