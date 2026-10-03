// Weekly client updates with health flags. Every Monday each active project
// gets a health check from its own CRM facts (tasks, due date, when the client
// last wrote) and a short status email drafted from what actually happened:
//
//   AT_RISK   an open task is more than 2 days overdue, or the project's due
//             date has passed and it is not delivered
//   QUIET     the client contact has not written for 14+ days (synced mail
//             and Inbox items both count)
//   ON_TRACK  otherwise
//
// AT_RISK and QUIET projects also get one task for the team (not repeated
// while the previous one is open). A project that had an update sent or
// drafted in the last 6 days is not drafted again, so a manual run mid-week
// and the Monday run do not double up.

import { DATA_NOT_INSTRUCTIONS, readJsonObject, str, type AgencyWriter } from 'src/gtm/agency/ai';
import { createClientEmail, type NewClientEmail } from 'src/gtm/agency/client-emails';
import { createTaskFor, type Records } from 'src/gtm/agency/gql';
import type { AgencySettings } from 'src/gtm/agency/settings';
import { ACTIVE_PROJECT_STATUSES, type ClientEmailKind, type ProjectHealth, type ProjectStatus } from 'src/gtm/agency/values';

export const DAY = 24 * 60 * 60 * 1000;
export const OVERDUE_GRACE_DAYS = 2;
export const QUIET_AFTER_DAYS = 14;
export const UPDATE_DEDUPE_DAYS = 6;
const WEEK_DAYS = 7;

// Twenty names the task/note target relation for a custom object
// target<NameSingular>, so its join column is targetClientProjectId.
export const PROJECT_TARGET_FIELD = 'targetClientProjectId';

export type ProjectRow = {
  id: string;
  name: string | null;
  status: ProjectStatus | null;
  health: ProjectHealth | null;
  startDate: string | null;
  dueDate: string | null;
  deliveredAt: string | null;
  value: number | null;
  renewalDate: string | null;
  lastClientUpdateAt: string | null;
  lastClientContactAt: string | null;
  upsellDraftedAt: string | null;
  referralDraftedAt: string | null;
  companyId: string | null;
  personId: string | null;
  serviceId: string | null;
};

export const PROJECT_SELECTION = {
  name: true,
  status: true,
  health: true,
  startDate: true,
  dueDate: true,
  deliveredAt: true,
  value: true,
  renewalDate: true,
  lastClientUpdateAt: true,
  lastClientContactAt: true,
  upsellDraftedAt: true,
  referralDraftedAt: true,
  companyId: true,
  personId: true,
  serviceId: true,
};

export type TaskRow = { id: string; title: string | null; status: string | null; dueAt: string | null; updatedAt: string | null };
type NoteRow = { id: string; title: string | null; createdAt: string | null; bodyV2?: { markdown?: string | null } | null };

export type Contact = { id: string; firstName: string | null; lastName: string | null; email: string | null; company: string | null };

const time = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const latest = (...isos: (string | null | undefined)[]): string | null => {
  let best: string | null = null;
  for (const iso of isos) {
    const t = time(iso);
    if (t !== null && (best === null || t > (time(best) ?? 0))) best = new Date(t).toISOString();
  }
  return best;
};

// --- Reads ---------------------------------------------------------------

export const loadContact = async (records: Records, project: Pick<ProjectRow, 'personId' | 'companyId'>): Promise<Contact | null> => {
  if (!project.personId) return null;
  const p = await records.findOne<{ id: string; name?: { firstName?: string | null; lastName?: string | null } | null; emails?: { primaryEmail?: string | null } | null }>(
    'people',
    project.personId,
    { name: { firstName: true, lastName: true }, emails: { primaryEmail: true } },
  );
  if (!p) return null;
  const company = project.companyId ? await records.findOne<{ name: string | null }>('companies', project.companyId, { name: true }) : null;
  return {
    id: p.id,
    firstName: p.name?.firstName?.trim() || null,
    lastName: p.name?.lastName?.trim() || null,
    email: p.emails?.primaryEmail?.trim().toLowerCase() || null,
    company: company?.name?.trim() || null,
  };
};

export const loadProjectTasks = async (records: Records, projectId: string): Promise<TaskRow[]> => {
  const links = await records.findMany<{ taskId: string | null }>('taskTargets', { [PROJECT_TARGET_FIELD]: { eq: projectId } }, { taskId: true }, 200);
  const ids = [...new Set(links.map((l) => l.taskId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  return records.findMany<TaskRow>('tasks', { id: { in: ids } }, { title: true, status: true, dueAt: true, updatedAt: true }, ids.length);
};

const loadRecentNotes = async (records: Records, projectId: string, since: Date): Promise<NoteRow[]> => {
  const links = await records.findMany<{ noteId: string | null }>('noteTargets', { [PROJECT_TARGET_FIELD]: { eq: projectId } }, { noteId: true }, 100);
  const ids = [...new Set(links.map((l) => l.noteId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  return records.findMany<NoteRow>(
    'notes',
    { and: [{ id: { in: ids } }, { createdAt: { gte: since.toISOString() } }] },
    { title: true, createdAt: true, bodyV2: { markdown: true } },
    20,
  );
};

// When the contact last wrote: the newest synced message they sent, or the
// newest Inbox item from them (bounces are not the client writing).
export const latestClientContact = async (records: Records, personId: string): Promise<string | null> => {
  const sent = await records.findMany<{ messageId: string | null }>(
    'messageParticipants',
    { and: [{ personId: { eq: personId } }, { role: { eq: 'FROM' } }] },
    { messageId: true },
    100,
  );
  const messageIds = [...new Set(sent.map((s) => s.messageId).filter((id): id is string => Boolean(id)))];
  const [message] = messageIds.length
    ? await records.findMany<{ receivedAt: string | null }>('messages', { id: { in: messageIds } }, { receivedAt: true }, 1, [{ receivedAt: 'DescNullsLast' }])
    : [];
  const [inbox] = await records.findMany<{ receivedAt: string | null }>(
    'inboxItems',
    { and: [{ personId: { eq: personId } }, { kind: { neq: 'BOUNCE' } }] },
    { receivedAt: true },
    1,
    [{ receivedAt: 'DescNullsLast' }],
  );
  return latest(message?.receivedAt, inbox?.receivedAt);
};

// Client emails of one kind for a project since a date (skipped ones do not count).
export const recentClientEmails = (records: Records, projectId: string, kind: ClientEmailKind, since: Date) =>
  records.findMany<{ id: string; status: string | null }>(
    'clientEmails',
    { and: [{ projectId: { eq: projectId } }, { kind: { eq: kind } }, { createdAt: { gte: since.toISOString() } }, { status: { neq: 'SKIPPED' } }] },
    { status: true },
    5,
  );

// --- Pure rules ----------------------------------------------------------

export const isOpenTask = (t: TaskRow) => t.status !== 'DONE';

export const overdueTasks = (tasks: TaskRow[], now: Date, graceDays = 0) =>
  tasks.filter((t) => {
    const due = time(t.dueAt);
    return isOpenTask(t) && due !== null && due < now.getTime() - graceDays * DAY;
  });

export const projectHealth = ({
  project,
  tasks,
  lastContactAt,
  now,
}: {
  project: Pick<ProjectRow, 'dueDate' | 'status' | 'deliveredAt' | 'startDate'>;
  tasks: TaskRow[];
  lastContactAt: string | null;
  now: Date;
}): ProjectHealth => {
  const delivered = project.status === 'DELIVERED' || Boolean(project.deliveredAt);
  if (overdueTasks(tasks, now, OVERDUE_GRACE_DAYS).length > 0) return 'AT_RISK';
  if (!delivered && project.dueDate && project.dueDate < isoDay(now)) return 'AT_RISK';
  // Never heard from them: quiet once the project is 14+ days old.
  const since = time(lastContactAt) ?? time(project.startDate);
  if (since !== null && now.getTime() - since >= QUIET_AFTER_DAYS * DAY) return 'QUIET';
  return 'ON_TRACK';
};

// --- AI drafting ---------------------------------------------------------

export const draftEmail = async (
  writer: AgencyWriter,
  instructions: string,
  data: Record<string, unknown>,
): Promise<{ subject: string; body: string } | null> => {
  const prompt = `${DATA_NOT_INSTRUCTIONS}\n\n<data>\n${JSON.stringify(data, null, 2)}\n</data>\n\nReply with only a JSON object: {"subject": "...", "body": "..."}. The body is plain text with blank lines between paragraphs.`;
  const json = readJsonObject(await writer.write(instructions, prompt, 1200));
  const subject = str(json?.subject, 200);
  const body = str(json?.body, 6000);
  return subject && body ? { subject, body } : null;
};

export const WEEKLY_UPDATE_INSTRUCTIONS = `You write the weekly status email an agency sends to a client about their project.
Keep it short (under 180 words), warm and plain. Three parts: what was done this week, what is next, and anything we need from the client (only if the data shows something; otherwise say nothing is needed).
Be honest: if tasks are overdue or the due date has passed, say so briefly and give the next step. Use only the tasks and notes in the data; never invent work, results or dates. Address the contact by first name if known. Sign off as "The team".`;

const taskLine = (t: TaskRow) => `${t.title ?? 'Untitled task'}${t.dueAt ? ` (due ${t.dueAt.slice(0, 10)})` : ''}`;

// --- Run -----------------------------------------------------------------

export type WeeklyUpdatesResult = {
  ok: boolean;
  projects: number;
  drafted: number;
  skipped: number;
  failed: number;
  onTrack: number;
  atRisk: number;
  quiet: number;
  tasksCreated: number;
  errors: string[];
};

const HEALTH_TASK_TITLE: Partial<Record<ProjectHealth, (name: string) => string>> = {
  AT_RISK: (name) => `Project at risk: ${name}`,
  QUIET: (name) => `Quiet client, check in: ${name}`,
};

export const weeklyClientUpdates = async ({
  records,
  writer,
  settings,
  now = new Date(),
  projectId,
  force = false,
}: {
  records: Records;
  writer: AgencyWriter;
  settings: AgencySettings;
  now?: Date;
  // Run for one project only (any status), e.g. from the tool.
  projectId?: string;
  // Draft even if an update went out in the last 6 days.
  force?: boolean;
}): Promise<WeeklyUpdatesResult> => {
  const result: WeeklyUpdatesResult = { ok: true, projects: 0, drafted: 0, skipped: 0, failed: 0, onTrack: 0, atRisk: 0, quiet: 0, tasksCreated: 0, errors: [] };
  const projects = await records.findMany<ProjectRow>(
    'clientProjects',
    projectId ? { id: { eq: projectId } } : { status: { in: [...ACTIVE_PROJECT_STATUSES] } },
    PROJECT_SELECTION,
    200,
  );
  const weekAgo = new Date(now.getTime() - WEEK_DAYS * DAY);

  for (const project of projects) {
    result.projects += 1;
    try {
      const name = project.name?.trim() || 'Project';
      const tasks = await loadProjectTasks(records, project.id);
      const contactAt = latest(project.lastClientContactAt, project.personId ? await latestClientContact(records, project.personId) : null);
      const health = projectHealth({ project, tasks, lastContactAt: contactAt, now });
      if (health === 'AT_RISK') result.atRisk += 1;
      else if (health === 'QUIET') result.quiet += 1;
      else result.onTrack += 1;

      const patch: Record<string, unknown> = {};
      if (health !== project.health) patch.health = health;
      if (contactAt && time(contactAt) !== time(project.lastClientContactAt)) patch.lastClientContactAt = contactAt;
      await records.update('clientProject', project.id, patch);

      const open = tasks.filter(isOpenTask);
      const taskTitle = HEALTH_TASK_TITLE[health]?.(name);
      if (taskTitle && !open.some((t) => t.title?.trim() === taskTitle)) {
        const overdue = overdueTasks(tasks, now, OVERDUE_GRACE_DAYS);
        const body =
          health === 'AT_RISK'
            ? [
                overdue.length ? `Overdue tasks:\n${overdue.map((t) => `- ${taskLine(t)}`).join('\n')}` : null,
                project.dueDate && project.dueDate < isoDay(now) ? `The project was due ${project.dueDate}.` : null,
                'Decide the next step and tell the client honestly in the weekly update.',
              ]
            : [`The client has not written since ${contactAt?.slice(0, 10) ?? 'the project started'}. Check in with them.`];
        await createTaskFor(
          records,
          { title: taskTitle, body: body.filter(Boolean).join('\n\n'), dueAt: now.toISOString() },
          { [PROJECT_TARGET_FIELD]: project.id, targetPersonId: project.personId },
        );
        result.tasksCreated += 1;
      }

      // One update per week: skip if one was sent or drafted in the last 6 days.
      const dedupeSince = new Date(now.getTime() - UPDATE_DEDUPE_DAYS * DAY);
      const recentlySent = (time(project.lastClientUpdateAt) ?? 0) >= dedupeSince.getTime();
      if (!force && (recentlySent || (await recentClientEmails(records, project.id, 'WEEKLY_UPDATE', dedupeSince)).length > 0)) {
        result.skipped += 1;
        continue;
      }
      const contact = await loadContact(records, project);
      if (!contact) {
        result.skipped += 1;
        continue;
      }

      const notes = await loadRecentNotes(records, project.id, weekAgo);
      const doneThisWeek = tasks.filter((t) => t.status === 'DONE' && (time(t.updatedAt) ?? 0) >= weekAgo.getTime());
      const draft = await draftEmail(writer, WEEKLY_UPDATE_INSTRUCTIONS, {
        project: name,
        status: project.status,
        health,
        dueDate: project.dueDate,
        dueDatePassed: Boolean(project.dueDate && project.dueDate < isoDay(now)),
        contact: { firstName: contact.firstName, company: contact.company },
        doneThisWeek: doneThisWeek.map(taskLine),
        nextUp: open.map(taskLine).slice(0, 10),
        overdue: overdueTasks(tasks, now).map(taskLine),
        notesThisWeek: notes.map((n) => [n.title, n.bodyV2?.markdown?.slice(0, 600)].filter(Boolean).join(': ')),
      });
      if (!draft) {
        result.failed += 1;
        result.errors.push(`${name}: the AI reply had no subject or body`);
        continue;
      }
      const email: NewClientEmail = { kind: 'WEEKLY_UPDATE', ...draft, toEmail: contact.email, personId: contact.id, projectId: project.id };
      await createClientEmail(records, email, settings.autoSend);
      result.drafted += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${project.name ?? project.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  result.ok = result.failed === 0;
  return result;
};
