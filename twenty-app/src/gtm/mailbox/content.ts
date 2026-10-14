import { pickOne } from 'src/gtm/mailbox/random';

// Plain, varied business small talk for warmup emails. Combined at random so
// no two emails are identical. No links, no images, no tracking.

const SUBJECTS = [
  'Quick question about next week',
  'Notes from today',
  'Following up on the plan',
  'Thoughts on the draft',
  'Catching up',
  'Agenda for Thursday',
  'Small update',
  'Re-sharing the summary',
  'Timeline check',
  'One more idea',
  'Checking in',
  'About the proposal',
];

const GREETINGS = ['Hi {name},', 'Hey {name},', 'Hello {name},', '{name},', 'Morning {name},'];

const OPENERS = [
  'Hope your week is going well.',
  'Thanks again for the quick turnaround.',
  'I was going through my notes from earlier.',
  'Just wanted to close the loop on this.',
  'Had a few minutes, so writing this down before I forget.',
  'Following up on what we discussed.',
];

const BODIES = [
  'Could we move the review to later in the week? Thursday afternoon works best on my side.',
  'I put together a short outline and would love your take before I share it more widely.',
  'The numbers look better than last month, mostly thanks to the changes in onboarding.',
  'I think we can simplify the second step and save everyone some time.',
  'Let me know if you need anything else from me to get this over the line.',
  'I spoke with the team and they are happy with the direction so far.',
  'Do you have the latest version of the document? I want to make sure I am not working from an old copy.',
  'No rush on this, whenever you get a chance is fine.',
];

const CLOSINGS = ['Thanks,', 'Best,', 'Cheers,', 'Talk soon,', 'Regards,'];

const REPLIES = [
  'Thanks for this, makes sense to me.',
  'Sounds good, Thursday works.',
  'Got it, I will take a look today.',
  'Appreciate the update. Let us keep it as planned.',
  'Great, thanks for sending it over.',
  'Agreed. I will share my notes by tomorrow.',
];

const firstName = (displayName: string | null | undefined, email: string): string => {
  const source = displayName?.trim() || email.split('@')[0];
  const word = source.split(/[\s._-]+/)[0] ?? source;
  return word.charAt(0).toUpperCase() + word.slice(1);
};

export type WarmupContent = { subject: string; text: string };

export const generateWarmupEmail = (
  rng: () => number,
  to: { email: string; displayName?: string | null },
  from: { email: string; displayName?: string | null },
): WarmupContent => {
  const greeting = pickOne(GREETINGS, rng).replace('{name}', firstName(to.displayName, to.email));
  const lines = [greeting, '', pickOne(OPENERS, rng), pickOne(BODIES, rng)];
  if (rng() < 0.5) lines.push(pickOne(BODIES, rng));
  lines.push('', pickOne(CLOSINGS, rng), firstName(from.displayName, from.email));
  return { subject: pickOne(SUBJECTS, rng), text: lines.join('\n') };
};

export const generateWarmupReply = (
  rng: () => number,
  originalSubject: string,
  from: { email: string; displayName?: string | null },
): WarmupContent => {
  const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;
  return {
    subject,
    text: [pickOne(REPLIES, rng), '', pickOne(CLOSINGS, rng), firstName(from.displayName, from.email)].join('\n'),
  };
};
