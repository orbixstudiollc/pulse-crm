import { describe, expect, it } from 'vitest';

import { HEADCOUNT_LABELS, headcountIndex, headcountLabel, headcountValue } from 'src/gtm/leadfinder/headcount';
import {
  gradeFor,
  headcountMatch,
  industryMatch,
  locationMatch,
  scoreAgainstProfile,
  scoreLead,
  titleMatch,
  type IcpCriteria,
} from 'src/gtm/leadfinder/scoring';
import { HEADCOUNT_RANGES } from 'src/objects/icp-profile.object';

const saasMarketing: IcpCriteria = {
  id: 'icp-1',
  name: 'SaaS marketing leaders',
  jobTitles: ['Head of Marketing', 'CMO'],
  industries: ['Software Development'],
  locations: ['United Kingdom'],
  headcount: ['SIZE_51_100', 'SIZE_101_200'],
};

describe('headcount buckets', () => {
  it('match the ICP object options', () => {
    expect([...HEADCOUNT_LABELS]).toEqual([...HEADCOUNT_RANGES]);
  });

  it('convert between labels, SIZE values and counts', () => {
    expect(headcountValue('10000+')).toBe('SIZE_10000_PLUS');
    expect(headcountLabel('SIZE_51_100')).toBe('51-100');
    expect(headcountLabel('51-100')).toBe('51-100');
    expect(headcountLabel('nope')).toBeNull();
    expect(headcountIndex(75)).toBe(3);
    expect(headcountIndex(50000)).toBe(10);
    expect(headcountIndex('1,001-5,000')).toBe(7);
    expect(headcountIndex(null)).toBeNull();
  });
});

describe('criterion matching', () => {
  it('matches titles with aliases and partial function overlap', () => {
    expect(titleMatch('Chief Marketing Officer', ['CMO'])).toBe(1);
    expect(titleMatch('VP, Head of Marketing EMEA', ['Head of Marketing'])).toBe(1);
    expect(titleMatch('Marketing Manager', ['Head of Marketing'])).toBe(0.5);
    expect(titleMatch('Head of Sales', ['Head of Marketing'])).toBe(0);
    expect(titleMatch(null, ['CMO'])).toBe(0);
  });

  it('matches industries loosely', () => {
    expect(industryMatch('software development', ['Software Development'])).toBe(1);
    expect(industryMatch('Computer Software', ['Software Development'])).toBe(0.5);
    expect(industryMatch('Retail', ['Software Development'])).toBe(0);
  });

  it('matches cities inside countries and country aliases', () => {
    expect(locationMatch('London, England, United Kingdom', ['United Kingdom'])).toBe(1);
    expect(locationMatch('London, UK', ['United Kingdom'])).toBe(1);
    expect(locationMatch('Austin, TX, USA', ['United States'])).toBe(1);
    expect(locationMatch('Paris, France', ['United Kingdom'])).toBe(0);
  });

  it('gives half credit to a neighbouring size bucket', () => {
    expect(headcountMatch('51-100', ['SIZE_51_100'])).toBe(1);
    expect(headcountMatch('201-500', ['SIZE_51_100', 'SIZE_101_200'])).toBe(0.5);
    expect(headcountMatch(5, ['SIZE_51_100'])).toBe(0);
  });
});

describe('scoring', () => {
  it('grades by score band', () => {
    expect([gradeFor(100), gradeFor(80), gradeFor(79), gradeFor(60), gradeFor(40), gradeFor(39)]).toEqual([
      'A', 'A', 'B', 'B', 'C', 'D',
    ]);
  });

  it('scores a perfect fit 100 / A', () => {
    const r = scoreAgainstProfile(
      { jobTitle: 'CMO', industry: 'Software Development', location: 'London, UK', headcount: '51-100' },
      saasMarketing,
    );
    expect(r).toMatchObject({ score: 100, grade: 'A', profileId: 'icp-1' });
  });

  it('weights criteria: title 40, industry 25, location 15, size 20', () => {
    const r = scoreAgainstProfile(
      { jobTitle: 'Head of Marketing', industry: 'Retail', location: 'Paris, France', headcount: '201-500' },
      saasMarketing,
    );
    // 40 (title) + 0 + 0 + 10 (adjacent size) = 50
    expect(r).toMatchObject({ score: 50, grade: 'C', matches: { title: 1, industry: 0, location: 0, headcount: 0.5 } });
  });

  it('ignores criteria the profile leaves empty', () => {
    const r = scoreAgainstProfile({ jobTitle: 'CMO', industry: 'Retail' }, { id: 'x', jobTitles: ['CMO'] });
    expect(r).toMatchObject({ score: 100, grade: 'A', matches: { title: 1 } });
    expect(scoreAgainstProfile({ jobTitle: 'CMO' }, { id: 'empty', jobTitles: [' '] })).toBeNull();
  });

  it('scores missing lead data as no match', () => {
    expect(scoreAgainstProfile({}, saasMarketing)).toMatchObject({ score: 0, grade: 'D' });
  });

  it('keeps the best profile', () => {
    const sales: IcpCriteria = { id: 'icp-2', jobTitles: ['Head of Sales'], industries: ['Retail'] };
    const r = scoreLead({ jobTitle: 'Head of Sales', industry: 'Retail' }, [saasMarketing, sales]);
    expect(r).toMatchObject({ score: 100, profileId: 'icp-2' });
    expect(scoreLead({ jobTitle: 'CMO' }, [])).toBeNull();
  });
});
