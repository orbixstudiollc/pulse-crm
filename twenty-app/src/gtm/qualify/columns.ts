// Lead file parsing: CSV (or rows pasted from a sheet) to normalised lead
// rows, with the column mapping guessed from the header. Pure, so the Setup
// page can show the mapping before anything is imported.

import { toDomain } from 'src/gtm/prospeo/people';
import type { EmailStatus } from 'src/gtm/qualify/values';

export type LeadRow = {
  sourceRecordId?: string;
  prospeoPersonId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  emailStatus?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  companyName?: string;
  companyDomain?: string;
  companyLinkedinUrl?: string;
  industry?: string;
  headcount?: string;
  companyCity?: string;
  companyCountry?: string;
};

export type LeadColumn = keyof LeadRow;

export const LEAD_COLUMNS: { key: LeadColumn; label: string }[] = [
  { key: 'sourceRecordId', label: 'Source record ID' },
  { key: 'prospeoPersonId', label: 'Prospeo ID' },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'emailStatus', label: 'Email status' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'linkedinUrl', label: 'Person LinkedIn' },
  { key: 'location', label: 'Location' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'companyName', label: 'Company name' },
  { key: 'companyDomain', label: 'Company website' },
  { key: 'companyLinkedinUrl', label: 'Company LinkedIn' },
  { key: 'industry', label: 'Industry' },
  { key: 'headcount', label: 'Employees' },
  { key: 'companyCity', label: 'Company city' },
  { key: 'companyCountry', label: 'Company country' },
];

// Keys are header cells lowercased with everything but letters and digits removed.
// Covers Apollo, Prospeo, Sales Navigator and common hand-made sheets.
const HEADER_ALIASES: Record<string, LeadColumn> = {
  apollocontactid: 'sourceRecordId',
  contactid: 'sourceRecordId',
  sourceid: 'sourceRecordId',
  sourcerecordid: 'sourceRecordId',
  recordid: 'sourceRecordId',
  leadid: 'sourceRecordId',
  id: 'sourceRecordId',
  prospeoid: 'prospeoPersonId',
  prospeopersonid: 'prospeoPersonId',
  personid: 'prospeoPersonId',
  firstname: 'firstName',
  first: 'firstName',
  givenname: 'firstName',
  lastname: 'lastName',
  last: 'lastName',
  surname: 'lastName',
  familyname: 'lastName',
  name: 'fullName',
  fullname: 'fullName',
  contactname: 'fullName',
  personname: 'fullName',
  email: 'email',
  emailaddress: 'email',
  workemail: 'email',
  businessemail: 'email',
  personemail: 'email',
  emailstatus: 'emailStatus',
  emailverification: 'emailStatus',
  emailverificationstatus: 'emailStatus',
  verificationstatus: 'emailStatus',
  title: 'jobTitle',
  jobtitle: 'jobTitle',
  position: 'jobTitle',
  role: 'jobTitle',
  personlinkedinurl: 'linkedinUrl',
  linkedinurl: 'linkedinUrl',
  linkedin: 'linkedinUrl',
  linkedinprofile: 'linkedinUrl',
  linkedinprofileurl: 'linkedinUrl',
  profileurl: 'linkedinUrl',
  location: 'location',
  personlocation: 'location',
  city: 'city',
  personcity: 'city',
  state: 'state',
  region: 'state',
  personstate: 'state',
  country: 'country',
  personcountry: 'country',
  company: 'companyName',
  companyname: 'companyName',
  organization: 'companyName',
  organizationname: 'companyName',
  account: 'companyName',
  accountname: 'companyName',
  website: 'companyDomain',
  companywebsite: 'companyDomain',
  websiteurl: 'companyDomain',
  domain: 'companyDomain',
  companydomain: 'companyDomain',
  companyurl: 'companyDomain',
  companylinkedinurl: 'companyLinkedinUrl',
  companylinkedin: 'companyLinkedinUrl',
  industry: 'industry',
  companyindustry: 'industry',
  employees: 'headcount',
  numberofemployees: 'headcount',
  employeecount: 'headcount',
  companysize: 'headcount',
  headcount: 'headcount',
  companyheadcount: 'headcount',
  employeerange: 'headcount',
  companycity: 'companyCity',
  companycountry: 'companyCountry',
};

export const headerKey = (cell: string) => cell.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** One column per header cell; null when the column is not imported. A column is used once (first match wins). */
export const guessMapping = (headers: string[]): (LeadColumn | null)[] => {
  const used = new Set<LeadColumn>();
  return headers.map((h) => {
    const key = HEADER_ALIASES[headerKey(h)];
    if (!key || used.has(key)) return null;
    used.add(key);
    return key;
  });
};

const detectDelimiter = (firstLine: string): string => {
  const counts = [',', '\t', ';'].map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ',';
};

/** RFC 4180-ish: quoted cells may hold delimiters, doubled quotes and line breaks. */
export const parseDelimited = (text: string): string[][] => {
  const src = text.replace(/^﻿/, '');
  const firstLineEnd = src.search(/\r?\n/);
  const delimiter = detectDelimiter(firstLineEnd === -1 ? src : src.slice(0, firstLineEnd));
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
};

export type ParsedLeadFile = {
  headers: string[];
  mapping: (LeadColumn | null)[];
  rows: LeadRow[];
  // Rows without an email, a LinkedIn URL or a name (1-based line numbers of the data rows).
  unusable: number[];
};

export const rowsFromTable = (table: string[][], mapping?: (LeadColumn | null)[]): ParsedLeadFile => {
  const [headers = [], ...data] = table;
  const map = mapping ?? guessMapping(headers);
  const rows: LeadRow[] = [];
  const unusable: number[] = [];
  data.forEach((cells, i) => {
    const row: LeadRow = {};
    map.forEach((key, col) => {
      const value = cells[col]?.trim();
      if (key && value) row[key] = value;
    });
    if (!row.email && !row.linkedinUrl && !(row.fullName || row.firstName || row.lastName)) unusable.push(i + 1);
    else rows.push(cleanRow(row));
  });
  return { headers, mapping: map, rows, unusable };
};

export const parseLeadFile = (text: string, mapping?: (LeadColumn | null)[]): ParsedLeadFile =>
  rowsFromTable(parseDelimited(text), mapping);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const cleanRow = (row: LeadRow): LeadRow => {
  const out: LeadRow = { ...row };
  if (out.email) {
    const e = out.email.trim().toLowerCase();
    if (EMAIL_RE.test(e)) out.email = e;
    else delete out.email;
  }
  if (out.companyDomain) {
    const d = toDomain(out.companyDomain);
    if (d.includes('.')) out.companyDomain = d;
    else delete out.companyDomain;
  }
  if (!out.firstName && !out.lastName && out.fullName) {
    const full = out.fullName.trim();
    const i = full.indexOf(' ');
    out.firstName = i === -1 ? full : full.slice(0, i);
    out.lastName = i === -1 ? '' : full.slice(i + 1);
  }
  return out;
};

/** Map an email status from a lead file or a provider to the workspace's select value. */
export const emailStatusFrom = (raw: string | null | undefined, hasEmail: boolean): EmailStatus => {
  if (!hasEmail) return 'UNKNOWN';
  const v = (raw ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  if (!v) return 'UNVERIFIED';
  if (/\b(verified|valid|deliverable|safe)\b/.test(v) && !/\b(un|not|in)(verified|valid|deliverable)\b/.test(v)) return 'VERIFIED';
  if (/\b(invalid|undeliverable|bounced?|bad|disposable|spamtrap)\b/.test(v)) return 'INVALID';
  if (/\b(unsubscribed|suppressed|do not (contact|email)|opted out)\b/.test(v)) return 'SUPPRESSED';
  return 'UNVERIFIED';
};

export const personLocation = (row: LeadRow): string | undefined =>
  row.location || [row.city, row.state, row.country].filter(Boolean).join(', ') || undefined;
