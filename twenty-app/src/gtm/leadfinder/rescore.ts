import { icpCriteria, leadProfileFromPerson, scoreUpdate, type TwentyIcpRecord } from 'src/gtm/leadfinder/mapping';
import { scoreLead, type IcpCriteria, type ScoreResult } from 'src/gtm/leadfinder/scoring';
import { getPerson, listActiveIcpProfiles, updatePerson } from 'src/gtm/leadfinder/twenty';

export async function activeCriteria(): Promise<IcpCriteria[]> {
  return (await listActiveIcpProfiles()).map((icp: TwentyIcpRecord) => icpCriteria(icp));
}

export type RescoreOutcome = { personId: string; result: ScoreResult | null; updated: boolean };

/** Score one person against the given (or the active) ICPs; writes only when the score changes. */
export async function rescorePerson(personId: string, profiles?: IcpCriteria[]): Promise<RescoreOutcome> {
  const criteria = profiles ?? (await activeCriteria());
  const person = await getPerson(personId);
  if (!person) return { personId, result: null, updated: false };
  const result = scoreLead(leadProfileFromPerson(person), criteria);
  const update = scoreUpdate(person, result);
  if (update) await updatePerson(personId, update);
  return { personId, result, updated: Boolean(update) };
}
