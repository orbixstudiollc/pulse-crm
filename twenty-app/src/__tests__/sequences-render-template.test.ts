import { describe, expect, it } from 'vitest';

import {
  buildTemplateVariables,
  renderTemplate,
  templateVariables,
} from 'src/gtm/sequences/render-template';

describe('renderTemplate', () => {
  const vars = { firstName: 'Ada', company: 'Acme', empty: '  ', sender: { name: 'Sam' } };

  it('substitutes variables, with or without spaces', () => {
    expect(renderTemplate('Hi {{firstName}} at {{ company }}', vars).text).toBe('Hi Ada at Acme');
  });

  it('uses inline fallbacks, quoted or bare, for missing or blank values', () => {
    expect(renderTemplate('Hi {{lastName | "there"}}', vars).text).toBe('Hi there');
    expect(renderTemplate("Hi {{lastName|'friend'}}", vars).text).toBe('Hi friend');
    expect(renderTemplate('Hi {{empty|there}}!', vars).text).toBe('Hi there!');
    expect(renderTemplate('Hi {{firstName|there}}', vars).text).toBe('Hi Ada');
  });

  it('renders missing values as empty (or the default fallback) and reports them', () => {
    const r = renderTemplate('Hi {{lastName}} {{title}}', vars);
    expect(r.text).toBe('Hi  ');
    expect(r.missing).toEqual(['lastName', 'title']);
    expect(renderTemplate('{{nope}}', vars, { defaultFallback: '-' }).text).toBe('-');
  });

  it('matches snake_case and other casing to camelCase keys', () => {
    expect(renderTemplate('{{first_name}} / {{FIRSTNAME}}', vars).text).toBe('Ada / Ada');
  });

  it('resolves dotted paths', () => {
    expect(renderTemplate('{{sender.name}}', vars).text).toBe('Sam');
    expect(renderTemplate('{{sender.missing|x}}', vars).text).toBe('x');
  });

  it('does not re-expand template syntax inside values', () => {
    expect(renderTemplate('{{firstName}}', { firstName: '{{company}}', company: 'X' }).text).toBe(
      '{{company}}',
    );
  });

  it('escapes values but not template markup in html mode', () => {
    expect(renderTemplate('<b>{{firstName}}</b>', { firstName: '<i>A&B</i>' }, { html: true }).text).toBe(
      '<b>&lt;i&gt;A&amp;B&lt;/i&gt;</b>',
    );
  });

  it('handles null templates and leaves malformed tokens alone', () => {
    expect(renderTemplate(null, vars).text).toBe('');
    expect(renderTemplate('{{ }} {firstName}', vars).text).toBe('{{ }} {firstName}');
  });

  it('lists referenced variables', () => {
    expect(templateVariables('{{a}} {{ b | x }} {{a}}')).toEqual(['a', 'b']);
  });
});

describe('buildTemplateVariables', () => {
  it('maps a Twenty person to template variables', () => {
    const vars = buildTemplateVariables(
      {
        name: { firstName: ' Ada ', lastName: 'Lovelace' },
        emails: { primaryEmail: 'ada@acme.com' },
        jobTitle: 'CTO',
        company: { name: 'Acme', domainName: { primaryLinkUrl: 'https://www.acme.com/about' } },
      },
      { name: 'Sam' },
      new Date('2026-10-01T10:00:00Z'),
    );
    expect(vars).toMatchObject({
      firstName: 'Ada',
      fullName: 'Ada Lovelace',
      company: 'Acme',
      website: 'acme.com',
      senderName: 'Sam',
      dayOfWeek: 'Thursday',
    });
    expect(renderTemplate('Hi {{first_name}} from {{company}}', vars).text).toBe('Hi Ada from Acme');
  });

  it('falls back safely when the person has nothing', () => {
    const vars = buildTemplateVariables({});
    expect(renderTemplate('Hi {{firstName|there}} at {{company|your team}}', vars).text).toBe(
      'Hi there at your team',
    );
  });
});
