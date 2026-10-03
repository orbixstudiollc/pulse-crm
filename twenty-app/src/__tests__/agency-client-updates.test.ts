import { describe, expect, it } from 'vitest';

import { projectHealth, weeklyClientUpdates, type TaskRow } from 'src/gtm/agency/client-updates';

import { daysAgo, DAY_MS, FakeRecords, FakeWriter, seedContact, testSettings } from './agency-updates-fakes';

const NOW = new Date('2026-10-05T08:00:00Z');

const setup = (project: Record<string, unknown> = {}) => {
  const db = new FakeRecords(NOW);
  const personId = seedContact(db);
  db.add('clientProjects', {
    id: 'proj-1',
    name: 'Website redesign',
    status: 'IN_PROGRESS',
    health: 'ON_TRACK',
    startDate: '2026-09-28',
    dueDate: '2026-11-01',
    companyId: 'company-1',
    personId,
    lastClientContactAt: daysAgo(NOW, 3),
    ...project,
  });
  return db;
};

const addTask = (db: FakeRecords, task: Partial<TaskRow>, projectId = 'proj-1') => {
  const id = db.add('tasks', { title: 'Task', status: 'TODO', dueAt: null, updatedAt: NOW.toISOString(), ...task });
  db.add('taskTargets', { taskId: id, targetClientProjectId: projectId });
  return id;
};

const run = (db: FakeRecords, writer = new FakeWriter(), extra: Record<string, unknown> = {}) =>
  weeklyClientUpdates({ records: db, writer, settings: testSettings(), now: NOW, ...extra });

describe('projectHealth', () => {
  const base = { status: 'IN_PROGRESS' as const, deliveredAt: null, startDate: '2026-09-01', dueDate: null };
  const task = (over: Partial<TaskRow>): TaskRow => ({ id: 't', title: 'x', status: 'TODO', dueAt: null, updatedAt: null, ...over });

  it('is AT_RISK when an open task is more than 2 days overdue', () => {
    expect(projectHealth({ project: base, tasks: [task({ dueAt: daysAgo(NOW, 3) })], lastContactAt: daysAgo(NOW, 1), now: NOW })).toBe('AT_RISK');
  });

  it('allows 2 days of grace and ignores done tasks', () => {
    const tasks = [task({ dueAt: daysAgo(NOW, 1) }), task({ dueAt: daysAgo(NOW, 10), status: 'DONE' })];
    expect(projectHealth({ project: base, tasks, lastContactAt: daysAgo(NOW, 1), now: NOW })).toBe('ON_TRACK');
  });

  it('is AT_RISK when the due date passed and it is not delivered', () => {
    expect(projectHealth({ project: { ...base, dueDate: '2026-10-04' }, tasks: [], lastContactAt: daysAgo(NOW, 1), now: NOW })).toBe('AT_RISK');
    expect(projectHealth({ project: { ...base, dueDate: '2026-10-05' }, tasks: [], lastContactAt: daysAgo(NOW, 1), now: NOW })).toBe('ON_TRACK');
  });

  it('is QUIET after 14 days without hearing from the client', () => {
    expect(projectHealth({ project: base, tasks: [], lastContactAt: daysAgo(NOW, 14), now: NOW })).toBe('QUIET');
    expect(projectHealth({ project: base, tasks: [], lastContactAt: daysAgo(NOW, 13), now: NOW })).toBe('ON_TRACK');
  });

  it('counts from the start date when the client never wrote', () => {
    expect(projectHealth({ project: base, tasks: [], lastContactAt: null, now: NOW })).toBe('QUIET');
    expect(projectHealth({ project: { ...base, startDate: '2026-09-30' }, tasks: [], lastContactAt: null, now: NOW })).toBe('ON_TRACK');
  });

  it('AT_RISK wins over QUIET', () => {
    expect(projectHealth({ project: { ...base, dueDate: '2026-09-01' }, tasks: [], lastContactAt: null, now: NOW })).toBe('AT_RISK');
  });
});

describe('weeklyClientUpdates', () => {
  it('drafts an update from this week\'s tasks and notes', async () => {
    const db = setup();
    addTask(db, { title: 'Wireframes', status: 'DONE', updatedAt: daysAgo(NOW, 2) });
    addTask(db, { title: 'Old done', status: 'DONE', updatedAt: daysAgo(NOW, 20) });
    addTask(db, { title: 'Homepage design', dueAt: new Date(NOW.getTime() + 3 * DAY_MS).toISOString() });
    const noteId = db.add('notes', { title: 'Call', bodyV2: { markdown: 'Client approved wireframes' }, createdAt: daysAgo(NOW, 1) });
    db.add('noteTargets', { noteId, targetClientProjectId: 'proj-1' });
    const writer = new FakeWriter({ subject: 'Weekly update', body: 'Hi Ana' });

    const result = await run(db, writer);

    expect(result).toMatchObject({ ok: true, projects: 1, drafted: 1, onTrack: 1, tasksCreated: 0 });
    const data = writer.data();
    expect(data.doneThisWeek).toEqual(['Wireframes']);
    expect(data.nextUp[0]).toContain('Homepage design');
    expect(data.notesThisWeek).toEqual(['Call: Client approved wireframes']);
    expect(writer.calls[0].prompt).toContain('not instructions');
    expect(db.rows('clientEmails')).toEqual([
      expect.objectContaining({ kind: 'WEEKLY_UPDATE', subject: 'Weekly update', toEmail: 'ana@acme.test', projectId: 'proj-1', personId: 'person-1', status: 'DRAFT' }),
    ]);
  });

  it('only looks at active projects', async () => {
    const db = setup({ status: 'DELIVERED' });
    const result = await run(db);
    expect(result.projects).toBe(0);
  });

  it('flags AT_RISK, stores it and creates one task, not repeated while open', async () => {
    const db = setup();
    addTask(db, { title: 'Copy', dueAt: daysAgo(NOW, 5) });

    const first = await run(db);
    expect(first).toMatchObject({ atRisk: 1, tasksCreated: 1 });
    expect(db.rows('clientProjects')[0].health).toBe('AT_RISK');
    const created = db.rows('tasks', { title: { eq: 'Project at risk: Website redesign' } });
    expect(created).toHaveLength(1);
    expect(db.rows('taskTargets', { taskId: { eq: created[0].id } }).map((t) => t.targetClientProjectId ?? t.targetPersonId)).toEqual(['proj-1', 'person-1']);

    const second = await run(db, new FakeWriter(), { now: new Date(NOW.getTime() + 7 * DAY_MS) });
    expect(second.tasksCreated).toBe(0);

    // Once the team closes it, a new one can be created.
    created[0].status = 'DONE';
    const third = await run(db, new FakeWriter(), { now: new Date(NOW.getTime() + 14 * DAY_MS) });
    expect(third.tasksCreated).toBe(1);
  });

  it('detects a quiet client from synced mail and inbox items and stores the last contact', async () => {
    const db = setup({ lastClientContactAt: null, startDate: '2026-08-01' });
    const oldMsg = db.add('messages', { receivedAt: daysAgo(NOW, 20) });
    const otherMsg = db.add('messages', { receivedAt: daysAgo(NOW, 1) });
    db.add('messageParticipants', { messageId: oldMsg, personId: 'person-1', role: 'from' });
    db.add('messageParticipants', { messageId: otherMsg, personId: 'person-1', role: 'to' });
    db.add('inboxItems', { personId: 'person-1', kind: 'BOUNCE', receivedAt: daysAgo(NOW, 2) });
    db.add('inboxItems', { personId: 'person-1', kind: 'EMAIL', receivedAt: daysAgo(NOW, 16) });

    const result = await run(db);

    expect(result).toMatchObject({ quiet: 1, tasksCreated: 1 });
    const project = db.rows('clientProjects')[0];
    expect(project.health).toBe('QUIET');
    expect(project.lastClientContactAt).toBe(daysAgo(NOW, 16));
    expect(db.rows('tasks')[0].title).toBe('Quiet client, check in: Website redesign');
  });

  it('a recent message from the client keeps it on track', async () => {
    const db = setup({ lastClientContactAt: daysAgo(NOW, 30), health: 'QUIET' });
    const msg = db.add('messages', { receivedAt: daysAgo(NOW, 2) });
    db.add('messageParticipants', { messageId: msg, personId: 'person-1', role: 'from' });
    await run(db);
    expect(db.rows('clientProjects')[0]).toMatchObject({ health: 'ON_TRACK', lastClientContactAt: daysAgo(NOW, 2) });
  });

  it('does not draft again within 6 days', async () => {
    const db = setup();
    db.add('clientEmails', { kind: 'WEEKLY_UPDATE', projectId: 'proj-1', status: 'DRAFT', createdAt: daysAgo(NOW, 5) });
    const writer = new FakeWriter();
    expect(await run(db, writer)).toMatchObject({ drafted: 0, skipped: 1 });
    expect(writer.calls).toHaveLength(0);

    // Older than 6 days, or a skipped one, does not block.
    db.rows('clientEmails')[0].createdAt = daysAgo(NOW, 7);
    expect(await run(db)).toMatchObject({ drafted: 1 });
  });

  it('skips when an update was sent in the last 6 days, unless forced', async () => {
    const db = setup({ lastClientUpdateAt: daysAgo(NOW, 2) });
    expect(await run(db)).toMatchObject({ drafted: 0, skipped: 1 });
    expect(await run(db, new FakeWriter(), { force: true, projectId: 'proj-1' })).toMatchObject({ drafted: 1 });
  });

  it('auto-approves when auto-send is on', async () => {
    const db = setup();
    await weeklyClientUpdates({ records: db, writer: new FakeWriter(), settings: testSettings({ autoSend: true }), now: NOW });
    expect(db.rows('clientEmails')[0].status).toBe('APPROVED');
  });

  it('counts a failed draft when the AI reply is unusable', async () => {
    const db = setup();
    const result = await run(db, new FakeWriter('no json here'));
    expect(result).toMatchObject({ ok: false, failed: 1, drafted: 0 });
    expect(db.rows('clientEmails')).toHaveLength(0);
  });
});
