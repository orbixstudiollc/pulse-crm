import { defineLogicFunction } from 'twenty-sdk/define';

import { SCORE_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/leadfinder-ids';
import { leadProfileFromPerson, scoreUpdate } from 'src/gtm/leadfinder/mapping';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { activeCriteria, rescorePerson } from 'src/gtm/leadfinder/rescore';
import { scoreLead } from 'src/gtm/leadfinder/scoring';
import { listPeoplePage, updatePerson } from 'src/gtm/leadfinder/twenty';

type ScoreLeadsInput = { personIds?: string[]; limit?: number };

const MAX_BULK = 2000;

const handler = async (payload: unknown) => {
  const { personIds, limit } = toolOrRouteInput<ScoreLeadsInput>(payload);
  try {
    const profiles = await activeCriteria();
    if (profiles.length === 0) return { ok: false, error: 'No active ICP profiles to score against' };

    const tally = { scored: 0, updated: 0, unscored: 0, grades: { A: 0, B: 0, C: 0, D: 0 } as Record<string, number> };
    const count = (result: ReturnType<typeof scoreLead>, updated: boolean) => {
      if (!result) return void tally.unscored++;
      tally.scored++;
      tally.grades[result.grade]++;
      if (updated) tally.updated++;
    };

    if (personIds && personIds.length > 0) {
      for (const id of personIds.slice(0, MAX_BULK)) {
        const { result, updated } = await rescorePerson(id, profiles);
        count(result, updated);
      }
      return { ok: true, ...tally };
    }

    // No ids: rescore everyone, page by page, up to a cap.
    const cap = Math.min(Math.max(Number(limit) || MAX_BULK, 1), MAX_BULK);
    let cursor: string | undefined;
    let seen = 0;
    do {
      const page = await listPeoplePage(cursor);
      for (const person of page.records) {
        if (seen++ >= cap) break;
        const result = scoreLead(leadProfileFromPerson(person), profiles);
        const update = scoreUpdate(person, result);
        if (update) await updatePerson(person.id, update);
        count(result, Boolean(update));
      }
      cursor = page.hasNextPage ? page.endCursor : undefined;
    } while (cursor && seen < cap);
    return { ok: true, ...tally, truncated: Boolean(cursor) };
  } catch (err) {
    return failure(err);
  }
};

export default defineLogicFunction({
  universalIdentifier: SCORE_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'score-leads',
  description:
    'Score people against the active ICP profiles (job title, industry, location, company size) and set Lead score (0-100) and ICP grade (A-D). Pass personIds to score specific people, or nothing to rescore everyone.',
  timeoutSeconds: 300,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        personIds: { type: 'array', items: { type: 'string' }, description: 'People to score. Omit to rescore everyone.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_BULK, description: 'Max people to rescore when personIds is omitted' },
      },
    },
  },
  handler,
});
