import { guessProviderFromEmail } from 'src/gtm/mailbox/server-settings';
import type { MailboxRecord } from 'src/gtm/mailbox/types';
import type { MailboxProvider } from 'src/gtm/mailbox/values';

// Pure helpers for adding many mailboxes at once: CSV paste parsing, Google
// Workspace directory filtering, and dedupe against what is already in Twenty.

export type NewMailboxInput = Pick<
  MailboxRecord,
  'email' | 'displayName' | 'provider' | 'authType' | 'status' | 'warmupEnabled' | 'smtpHost' | 'smtpPort' | 'imapHost' | 'imapPort'
> & { credentialCiphertext?: string | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

// ---------- dedupe ----------

export type DedupeResult<T> = { fresh: T[]; skippedExisting: string[]; skippedDuplicate: string[] };

// Keeps the first occurrence of each address that is not already a mailbox.
export const dedupeNewMailboxes = <T extends { email: string }>(
  candidates: readonly T[],
  existingEmails: Iterable<string>,
): DedupeResult<T> => {
  const existing = new Set([...existingEmails].map(normalizeEmail));
  const seen = new Set<string>();
  const result: DedupeResult<T> = { fresh: [], skippedExisting: [], skippedDuplicate: [] };
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate.email);
    if (existing.has(email)) result.skippedExisting.push(email);
    else if (seen.has(email)) result.skippedDuplicate.push(email);
    else {
      seen.add(email);
      result.fresh.push({ ...candidate, email });
    }
  }
  return result;
};

// ---------- CSV ----------

export type CsvMailboxRow = {
  line: number;
  email: string;
  password: string;
  displayName: string | null;
  provider: MailboxProvider | null;
  smtpHost: string | null;
  smtpPort: number | null;
  imapHost: string | null;
  imapPort: number | null;
};

export type CsvParseResult = { rows: CsvMailboxRow[]; errors: { line: number; message: string }[] };

const splitCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"' && current.trim() === '') {
      quoted = true;
      current = '';
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = '';
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
};

const HEADER_ALIASES: Record<string, keyof Omit<CsvMailboxRow, 'line'>> = {
  email: 'email',
  emailaddress: 'email',
  password: 'password',
  apppassword: 'password',
  displayname: 'displayName',
  name: 'displayName',
  sendername: 'displayName',
  provider: 'provider',
  smtphost: 'smtpHost',
  smtpport: 'smtpPort',
  imaphost: 'imapHost',
  imapport: 'imapPort',
};

const POSITIONAL: (keyof Omit<CsvMailboxRow, 'line'>)[] = ['email', 'password', 'displayName'];

const PROVIDERS: Record<string, MailboxProvider> = {
  google: 'GOOGLE',
  gmail: 'GOOGLE',
  microsoft: 'MICROSOFT',
  outlook: 'MICROSOFT',
  office365: 'MICROSOFT',
  other: 'OTHER',
};

const toPort = (value: string | undefined): number | null => {
  if (!value) return null;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
};

// Parses a pasted list of mailboxes. Accepts comma, semicolon or tab
// separators, an optional header row (email, password, display name, provider,
// smtp host/port, imap host/port), blank lines and "#" comments. Without a
// header the columns are: email, app password, display name.
export const parseMailboxCsv = (text: string): CsvParseResult => {
  const result: CsvParseResult = { rows: [], errors: [] };
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let columns: (keyof Omit<CsvMailboxRow, 'line'> | null)[] | null = null;
  let delimiter: string | null = null;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    delimiter ??= line.includes('\t') ? '\t' : !line.includes(',') && line.includes(';') ? ';' : ',';
    const cells = splitCsvLine(line, delimiter);

    if (columns === null) {
      const mapped = cells.map((cell) => HEADER_ALIASES[cell.toLowerCase().replace(/[^a-z]/g, '')] ?? null);
      if (mapped.includes('email')) {
        columns = mapped;
        return;
      }
      columns = POSITIONAL;
    }

    const value = (key: keyof Omit<CsvMailboxRow, 'line'>) => {
      const position = columns!.indexOf(key);
      const cell = position >= 0 ? cells[position] : undefined;
      return cell === undefined || cell === '' ? undefined : cell;
    };

    const email = value('email');
    if (!email || !EMAIL_PATTERN.test(email)) {
      result.errors.push({ line: lineNumber, message: `Not an email address: ${email ?? '(empty)'}` });
      return;
    }
    const explicitProvider = value('provider');
    const provider = explicitProvider
      ? (PROVIDERS[explicitProvider.toLowerCase()] ?? null)
      : guessProviderFromEmail(email);
    let password = value('password');
    if (!password) {
      result.errors.push({ line: lineNumber, message: `Missing app password for ${email}` });
      return;
    }
    // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces are not part of it.
    if (provider === 'GOOGLE' && /^[a-z]{4}( [a-z]{4}){3}$/i.test(password)) password = password.replace(/ /g, '');

    result.rows.push({
      line: lineNumber,
      email: normalizeEmail(email),
      password,
      displayName: value('displayName') ?? null,
      provider,
      smtpHost: value('smtpHost') ?? null,
      smtpPort: toPort(value('smtpPort')),
      imapHost: value('imapHost') ?? null,
      imapPort: toPort(value('imapPort')),
    });
  });

  return result;
};

// Mailbox record for a CSV row. Google and Microsoft hosts are filled in by
// serverSettingsFor at send time, so they stay empty unless given.
export const mailboxInputFromCsvRow = (row: CsvMailboxRow, credentialCiphertext: string): NewMailboxInput => {
  const provider = row.provider ?? 'OTHER';
  return {
    email: row.email,
    displayName: row.displayName,
    provider,
    authType: 'PASSWORD',
    status: 'WARMING',
    warmupEnabled: true,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    imapHost: row.imapHost,
    imapPort: row.imapPort,
    credentialCiphertext,
  };
};

// Rows that will not work: a custom-domain mailbox needs its hosts.
export const csvRowProblem = (row: CsvMailboxRow): string | null =>
  (row.provider ?? 'OTHER') === 'OTHER' && (!row.smtpHost || !row.imapHost)
    ? `${row.email}: provider unknown, add provider (google/microsoft) or smtpHost and imapHost columns`
    : null;

// ---------- Google Workspace directory ----------

export type DirectoryUser = {
  primaryEmail: string;
  name?: { fullName?: string | null } | null;
  suspended?: boolean | null;
  archived?: boolean | null;
  orgUnitPath?: string | null;
};

export type WorkspaceImportFilter = {
  domain?: string | null;
  orgUnitPath?: string | null;
  emails?: string[] | null;
};

// Active users matching every given filter. An OU filter includes child OUs.
export const filterWorkspaceUsers = (users: readonly DirectoryUser[], filter: WorkspaceImportFilter = {}): DirectoryUser[] => {
  const domain = filter.domain?.trim().toLowerCase().replace(/^@/, '') || null;
  const ou = filter.orgUnitPath?.trim().replace(/\/+$/, '') || null;
  const emails = filter.emails?.length ? new Set(filter.emails.map(normalizeEmail)) : null;
  return users.filter((user) => {
    if (user.suspended || user.archived || !user.primaryEmail) return false;
    const email = normalizeEmail(user.primaryEmail);
    if (domain && !email.endsWith(`@${domain}`)) return false;
    if (ou && ou !== '' && ou !== '/') {
      const path = user.orgUnitPath ?? '/';
      if (path !== ou && !path.startsWith(`${ou}/`)) return false;
    }
    if (emails && !emails.has(email)) return false;
    return true;
  });
};

export const mailboxInputFromDirectoryUser = (user: DirectoryUser): NewMailboxInput => ({
  email: normalizeEmail(user.primaryEmail),
  displayName: user.name?.fullName?.trim() || null,
  provider: 'GOOGLE',
  authType: 'GOOGLE_DELEGATED',
  status: 'WARMING',
  warmupEnabled: true,
  smtpHost: null,
  smtpPort: null,
  imapHost: null,
  imapPort: null,
});
