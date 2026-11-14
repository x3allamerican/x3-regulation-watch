// X3 Regulation Watch: pull recent amendments (eCFR) and new rules and proposals (Federal Register) for the
// parts in watch.json, and write docs/data.json, docs/feed.xml (Atom) and one Atom feed per group.
// Zero dependencies. Node 18+. Run: node scripts/update.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./watch.json', import.meta.url), 'utf8'));
const UA = { 'User-Agent': 'x3-regulation-watch (+https://github.com/x3allamerican/x3-regulation-watch)' };
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res.json();
    if (i >= tries - 1 || res.status < 500) throw new Error(`${res.status} for ${url}`);
    await sleep(2000 * (i + 1));
  }
}

const ecfrLink = (title, part, section, date) =>
  `https://www.ecfr.gov/${date ? `on/${date}` : 'current'}/title-${title}/${section && /^\d+\.\d+/.test(section) ? `section-${section}` : `part-${part}`}`;

async function amendments(title, parts, since) {
  const out = [];
  for (const part of parts) {
    const d = await getJson(`https://www.ecfr.gov/api/versioner/v1/versions/title-${title}.json?part=${part}&issue_date%5Bgte%5D=${since}`);
    const seen = new Set();
    for (const v of d.content_versions ?? []) {
      if (!v.substantive || v.date < since) continue;
      const key = `${v.date}|${v.identifier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: 'amendment', date: v.date, title, part, identifier: v.identifier, name: v.name.replace(/\s+/g, ' ').trim(), removed: v.removed,
        citation: /^\d+\.\d+/.test(v.identifier) ? `${title} CFR ${v.identifier}` : `${title} CFR Part ${part}, ${v.identifier}`,
        url: ecfrLink(title, part, v.identifier, v.date),
      });
    }
    await sleep(250);
  }
  return out;
}

async function federalRegister(agencies, since) {
  const q = new URLSearchParams({ per_page: '100', order: 'newest', 'conditions[publication_date][gte]': since });
  for (const a of agencies) q.append('conditions[agencies][]', a);
  for (const t of ['RULE', 'PRORULE']) q.append('conditions[type][]', t);
  for (const f of ['title', 'type', 'publication_date', 'html_url', 'cfr_references', 'comments_close_on', 'effective_on', 'document_number', 'abstract', 'action']) q.append('fields[]', f);
  const d = await getJson(`https://www.federalregister.gov/api/v1/documents.json?${q}`);
  return (d.results ?? []).map((r) => ({
    kind: r.type === 'Rule' ? 'final-rule' : 'proposed-rule', date: r.publication_date, title: r.title, action: r.action, documentNumber: r.document_number,
    cfr: (r.cfr_references ?? []).map((c) => `${c.title} CFR ${c.part}`), commentsClose: r.comments_close_on, effective: r.effective_on,
    summary: r.abstract, url: r.html_url,
  }));
}

const groups = [];
for (const g of cfg.groups) {
  const since = daysAgo(cfg.lookbackDays);
  const changes = (await Promise.all(g.cfr.map((c) => amendments(c.title, c.parts, since)))).flat();
  // Keep only Federal Register documents that touch a watched part (drops local safety zones, bridge openings, etc.).
  const watched = new Set(g.cfr.flatMap((c) => c.parts.map((p) => `${c.title} CFR ${p}`)));
  const fr = (await federalRegister(g.agencies, daysAgo(cfg.federalRegisterDays))).filter((x) => x.cfr.some((c) => watched.has(c)));
  const items = [...changes, ...fr].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const openComments = fr.filter((x) => x.kind === 'proposed-rule' && x.commentsClose && x.commentsClose >= today);
  groups.push({ id: g.id, name: g.name, site: g.site, watching: g.cfr.map((c) => `${c.title} CFR ${c.parts.join(', ')}`), counts: { amendments: changes.length, finalRules: fr.filter((x) => x.kind === 'final-rule').length, proposedRules: fr.filter((x) => x.kind === 'proposed-rule').length, openComments: openComments.length }, openComments, items });
  console.log(`${g.id}: ${changes.length} amendments, ${fr.length} Federal Register documents`);
}

const data = { updated: new Date().toISOString(), lookbackDays: cfg.lookbackDays, federalRegisterDays: cfg.federalRegisterDays, groups };
mkdirSync('docs', { recursive: true });
writeFileSync('docs/data.json', JSON.stringify(data, null, 1) + '\n');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const BASE = 'https://x3allamerican.github.io/x3-regulation-watch/';
function atom(id, title, items) {
  const entries = items.slice(0, 100).map((x) => {
    const heading = x.kind === 'amendment' ? `Amended: ${x.name}` : `${x.kind === 'final-rule' ? 'Final rule' : 'Proposed rule'}: ${x.title}`;
    const body = x.kind === 'amendment' ? `${x.citation} was amended effective ${x.date}.` : `${x.action ?? ''} ${x.summary ?? ''} ${x.cfr?.length ? `Affects ${x.cfr.join(', ')}.` : ''} ${x.commentsClose ? `Comments close ${x.commentsClose}.` : ''} ${x.effective ? `Effective ${x.effective}.` : ''}`.trim();
    return `  <entry>
    <id>${esc(x.url)}#${esc(x.date)}</id>
    <title>${esc(heading)}</title>
    <link href="${esc(x.url)}"/>
    <updated>${x.date}T00:00:00Z</updated>
    <summary>${esc(body)}</summary>
  </entry>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${BASE}${id}</id>
  <title>${esc(title)}</title>
  <link href="${BASE}"/>
  <link rel="self" href="${BASE}${id}"/>
  <updated>${data.updated}</updated>
  <author><name>X3 Regulation Watch</name></author>
${entries}
</feed>
`;
}
writeFileSync('docs/feed.xml', atom('feed.xml', 'X3 Regulation Watch: FMCSA, OSHA, PHMSA and Coast Guard rule changes', groups.flatMap((g) => g.items).sort((a, b) => (a.date < b.date ? 1 : -1))));
for (const g of groups) writeFileSync(`docs/${g.id}.xml`, atom(`${g.id}.xml`, `X3 Regulation Watch: ${g.name}`, g.items));
console.log('wrote docs/data.json and feeds');
