// Runs every due sequence step once. Used by the sendSequenceSteps cron.

import { chooseVariant, openPixelHtml } from 'src/gtm/sequences/ab-testing';
import { transition } from 'src/gtm/sequences/enrollment-state';
import {
  buildTemplateVariables,
  escapeHtml,
  renderTemplate,
} from 'src/gtm/sequences/render-template';
import { retryAt } from 'src/gtm/sequences/scheduler';
import {
  personLabel,
  sortSteps,
  type EnrollmentPatch,
  type EnrollmentRecord,
  type SequenceRecord,
  type SequenceStore,
} from 'src/gtm/sequences/store';
import type { OutreachMailer } from 'src/gtm/sequences/transport';

export type SendDueStepsSummary = {
  due: number;
  sent: number;
  tasksCreated: number;
  finished: number;
  bounced: number;
  deferred: number;
  awaitingApproval: number;
  failed: number;
  skipped: number;
  errors: { enrollmentId: string; error: string }[];
};

const textToHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');

export const sendDueSteps = async ({
  store,
  mailer,
  now = new Date(),
  limit = 50,
}: {
  store: SequenceStore;
  mailer: OutreachMailer;
  now?: Date;
  limit?: number;
}): Promise<SendDueStepsSummary> => {
  const summary: SendDueStepsSummary = {
    due: 0,
    sent: 0,
    tasksCreated: 0,
    finished: 0,
    bounced: 0,
    deferred: 0,
    awaitingApproval: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  const winnersMarked = new Set<string>();

  const due = await store.findDueEnrollments(now, limit);
  summary.due = due.length;
  if (due.length === 0) return summary;

  const sequences = new Map<string, SequenceRecord | null>();
  const loadSequence = async (id: string) => {
    if (!sequences.has(id)) sequences.set(id, await store.getSequence(id));
    return sequences.get(id) ?? null;
  };
  const people = new Map(
    (await store.getPeople([...new Set(due.map((e) => e.personId))])).map((p) => [p.id, p]),
  );

  const finish = async (enrollment: EnrollmentRecord, patch: EnrollmentPatch) => {
    await store.updateEnrollment(enrollment.id, patch);
    if (patch.status === 'FINISHED') summary.finished += 1;
  };

  for (const enrollment of due) {
    try {
      const sequence = await loadSequence(enrollment.sequenceId);
      if (!sequence) {
        await finish(enrollment, transition(enrollment, { type: 'STOP', at: now, reason: 'Sequence deleted' }));
        summary.skipped += 1;
        continue;
      }
      // Paused or draft sequences keep their enrollments waiting.
      if (sequence.status !== 'ACTIVE') {
        summary.skipped += 1;
        continue;
      }

      const steps = sortSteps(sequence.steps);
      const schedule = { businessDaysOnly: Boolean(sequence.businessDaysOnly) };
      const step = steps[enrollment.currentStep - 1];
      if (!step) {
        await finish(enrollment, { status: 'FINISHED', nextSendAt: null });
        continue;
      }

      const person = people.get(enrollment.personId);
      if (!person) {
        await finish(enrollment, transition(enrollment, { type: 'STOP', at: now, reason: 'Person deleted' }));
        summary.skipped += 1;
        continue;
      }

      const advance = () =>
        transition(enrollment, { type: 'STEP_COMPLETED', at: now, steps, schedule });

      if (step.type === 'TASK') {
        await store.createTask({
          personId: person.id,
          title: `${sequence.name ?? 'Sequence'} step ${enrollment.currentStep}: ${personLabel(person)}`,
          body: step.instructions ?? null,
          dueAt: now.toISOString(),
        });
        summary.tasksCreated += 1;
        await finish(enrollment, { ...advance(), lastError: null });
        continue;
      }

      const to = person.emails?.primaryEmail?.trim();
      if (!to) {
        await finish(enrollment, transition(enrollment, { type: 'STOP', at: now, reason: 'No email address' }));
        summary.skipped += 1;
        continue;
      }
      if (sequence.requireApprovedOpener && enrollment.openerStatus !== 'APPROVED') {
        // Wait for a person to review the opener; look again in an hour.
        summary.awaitingApproval += 1;
        await store.updateEnrollment(enrollment.id, {
          lastError: 'Waiting for an approved opener',
          nextSendAt: retryAt(now).toISOString(),
        });
        continue;
      }

      const { variant, byWinner } = chooseVariant(step.variants ?? [], enrollment.id, step);
      if (variant && byWinner && !variant.isWinner && !winnersMarked.has(variant.id)) {
        winnersMarked.add(variant.id);
        await store.setVariantWinner(step.id, variant.id);
      }
      const subjectTemplate = variant?.subject?.trim() ? variant.subject : step.template?.subject;
      const bodyTemplate = variant?.body?.trim() ? variant.body : step.template?.body;
      if (!bodyTemplate?.trim()) {
        await store.updateEnrollment(enrollment.id, {
          lastError: `Step ${enrollment.currentStep} has no email template or variant`,
          nextSendAt: retryAt(now).toISOString(),
        });
        summary.failed += 1;
        summary.errors.push({ enrollmentId: enrollment.id, error: 'Step has no email template' });
        continue;
      }

      const from =
        enrollment.mailboxEmail ||
        (await mailer.mailboxes.pickMailbox({
          now,
          enrollmentId: enrollment.id,
          sequenceId: sequence.id,
        }));
      if (!from) {
        // Every mailbox is at its limit: try again on the next run.
        summary.deferred += 1;
        continue;
      }

      const vars = buildTemplateVariables(
        person,
        { name: mailer.sender?.name, email: from },
        now,
        enrollment,
      );
      const subject = renderTemplate(subjectTemplate, vars).text;
      const text = renderTemplate(bodyTemplate, vars).text;
      const pixel = mailer.openTrackingUrl
        ? `\n${openPixelHtml(mailer.openTrackingUrl, enrollment.id, variant?.id ?? null)}`
        : '';

      const result = await mailer.transport.send({
        from,
        to,
        subject,
        text,
        html: textToHtml(text) + pixel,
        enrollmentId: enrollment.id,
        sequenceId: sequence.id,
        stepNumber: enrollment.currentStep,
      });

      if (result.ok) {
        summary.sent += 1;
        await mailer.usage?.recordSend(from, now);
        await finish(enrollment, {
          ...advance(),
          mailboxEmail: from,
          lastError: null,
          lastVariantId: variant?.id ?? null,
        });
        if (variant) await store.incrementVariantStats(variant.id, { sent: 1 });
        if (enrollment.campaignId) await store.incrementCampaignStats(enrollment.campaignId, { sent: 1 });
      } else if (result.bounced) {
        summary.bounced += 1;
        await store.updateEnrollment(enrollment.id, {
          ...transition(enrollment, { type: 'BOUNCED', at: now }),
          lastError: result.error,
        });
      } else if (result.retryable) {
        summary.deferred += 1;
        await store.updateEnrollment(enrollment.id, {
          lastError: result.error,
          nextSendAt: retryAt(now).toISOString(),
        });
      } else {
        summary.failed += 1;
        summary.errors.push({ enrollmentId: enrollment.id, error: result.error });
        await store.updateEnrollment(enrollment.id, {
          ...transition(enrollment, { type: 'STOP', at: now, reason: 'Send failed' }),
          lastError: result.error,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.errors.push({ enrollmentId: enrollment.id, error: message });
      // Keep the enrollment but push it back so one bad record cannot block the queue.
      await store
        .updateEnrollment(enrollment.id, { lastError: message, nextSendAt: retryAt(now).toISOString() })
        .catch(() => undefined);
    }
  }

  return summary;
};
