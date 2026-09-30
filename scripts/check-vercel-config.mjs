import fs from 'node:fs';
const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const w = v.functions?.['app/api/cron/lead-finder-worker/route.ts']?.maxDuration;
if (w !== 300) { console.error('lead-finder-worker maxDuration is ' + w + ', expected 300'); process.exit(1); }
if (!Array.isArray(v.regions) || v.regions[0] !== 'sin1') { console.error('regions must be ["sin1"]'); process.exit(1); }
if (!Array.isArray(v.crons) || v.crons.length < 2) { console.error('crons missing'); process.exit(1); }
console.log('vercel.json ok');
