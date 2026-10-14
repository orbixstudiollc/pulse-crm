// In-memory fakes shared by the sequences tests (not a test file itself).
import type { OpenerContext } from 'src/gtm/sequences/openers';
import {
  pickEnrollmentPatch,
  type EnrollmentRecord,
  type NewInboxItem,
  type NewTask,
  type PersonRecord,
  type SequenceRecord,
  type SequenceStore,
  type VariantRecord,
  type VariantStatsDelta,
} from 'src/gtm/sequences/store';
import type { OutboundEmail, OutreachMailer, SendResult } from 'src/gtm/sequences/transport';

export class FakeStore implements SequenceStore {
  enrollments = new Map<string, EnrollmentRecord>();
  sequences = new Map<string, SequenceRecord>();
  people = new Map<string, PersonRecord>();
  campaigns = new Map<string, Record<string, number>>();
  inbox: (NewInboxItem & { id: string })[] = [];
  tasks: NewTask[] = [];
  private seq = 0;

  async findDueEnrollments(now: Date, limit: number) {
    return [...this.enrollments.values()]
      .filter((e) => e.status === 'ACTIVE' && e.nextSendAt && new Date(e.nextSendAt) <= now)
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }
  async findEnrollments(f: { personIds?: string[]; sequenceId?: string; activeOnly?: boolean }) {
    return [...this.enrollments.values()]
      .filter((e) => !f.personIds || f.personIds.includes(e.personId))
      .filter((e) => !f.sequenceId || e.sequenceId === f.sequenceId)
      .filter((e) => !f.activeOnly || e.status === 'ACTIVE')
      .map((e) => ({ ...e }));
  }
  async createEnrollment(data: any) {
    const id = `enr-${++this.seq}`;
    this.enrollments.set(id, { ...data, id });
    return id;
  }
  async updateEnrollment(id: string, patch: any) {
    const e = this.enrollments.get(id);
    if (e) this.enrollments.set(id, { ...e, ...pickEnrollmentPatch(patch) });
  }
  async getSequence(id: string) {
    return this.sequences.get(id) ?? null;
  }
  async getPeople(ids: string[]) {
    return ids.map((id) => this.people.get(id)).filter((p): p is PersonRecord => Boolean(p));
  }
  async findPersonByEmail(email: string) {
    return [...this.people.values()].find((p) => p.emails?.primaryEmail?.toLowerCase() === email) ?? null;
  }
  async setLeadStatus(personId: string, status: any) {
    const p = this.people.get(personId);
    if (p) p.leadStatus = status;
  }
  async incrementCampaignStats(id: string, delta: Record<string, number | undefined>) {
    const c = this.campaigns.get(id) ?? {};
    for (const [k, v] of Object.entries(delta)) c[k] = (c[k] ?? 0) + (v ?? 0);
    this.campaigns.set(id, c);
  }
  async hasInboxItemForMessage(messageId: string) {
    return this.inbox.some((i) => i.messageId === messageId);
  }
  async createInboxItem(data: NewInboxItem) {
    const id = `inbox-${++this.seq}`;
    this.inbox.push({ ...data, id });
    return id;
  }
  async createTask(data: NewTask) {
    this.tasks.push(data);
    return `task-${this.tasks.length}`;
  }
  variants = new Map<string, VariantRecord & { stepId: string }>();
  contexts = new Map<string, OpenerContext>();
  async getEnrollmentsByIds(ids: string[]) {
    return ids.map((id) => this.enrollments.get(id)).filter((e): e is EnrollmentRecord => Boolean(e)).map((e) => ({ ...e }));
  }
  async incrementVariantStats(id: string, delta: VariantStatsDelta) {
    const v = this.variants.get(id);
    if (!v) return;
    v.sent = (v.sent ?? 0) + (delta.sent ?? 0);
    v.opened = (v.opened ?? 0) + (delta.opened ?? 0);
    v.replied = (v.replied ?? 0) + (delta.replied ?? 0);
  }
  async setVariantWinner(stepId: string, variantId: string) {
    for (const v of this.variants.values()) if (v.stepId === stepId) v.isWinner = v.id === variantId;
  }
  async variantExists(id: string) {
    return this.variants.has(id);
  }
  async getOpenerContexts(personIds: string[]) {
    return new Map(personIds.filter((id) => this.contexts.has(id)).map((id) => [id, this.contexts.get(id)!]));
  }
}

export class FakeMailer implements OutreachMailer {
  sent: OutboundEmail[] = [];
  usage: { recordSend: (email: string) => Promise<void> };
  recorded: string[] = [];
  nextResult: SendResult = { ok: true, messageId: 'm1' };
  mailbox: string | null = 'sales@pulse.test';
  sender = { name: 'Sam' };
  openTrackingUrl: string | null = null;
  transport = {
    send: async (email: OutboundEmail) => {
      this.sent.push(email);
      return this.nextResult;
    },
  };
  mailboxes = {
    pickMailbox: async (ctx: { preferred?: string | null }) => ctx.preferred ?? this.mailbox,
  };
  constructor() {
    this.usage = { recordSend: async (email: string) => void this.recorded.push(email) };
  }
}
