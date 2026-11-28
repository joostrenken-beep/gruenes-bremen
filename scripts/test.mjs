// Schnelltest ohne Internet: node scripts/test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRss, parseMastodon, parseTypo3Liste, parseIcs, reinerText } from './fetch-news.mjs';
import { kompiliereRegeln, bewerte, clustere } from '../js/relevanz.js';

let ok = 0;
const test = (name, fn) => { fn(); ok++; console.log('✔', name); };

test('RSS mit CDATA und Entities', () => {
  const xml = `<rss><channel><item><title><![CDATA[Starkregen &amp; Hitze: Senat plant]]></title>
    <link>https://example.org/a</link><description>&lt;p&gt;Mehr Grün&lt;/p&gt;</description><pubDate>Fri, 27 Nov 2026 10:00:00 +0100</pubDate></item></channel></rss>`;
  const [it] = parseRss(xml);
  assert.equal(it.titel, 'Starkregen & Hitze: Senat plant');
  assert.equal(it.teaser, 'Mehr Grün');
  assert.equal(it.datum, '2026-11-27T09:00:00.000Z');
});

test('Atom mit link href', () => {
  const xml = `<feed><entry><title>Kita-Ausbau</title><link rel="alternate" href="https://example.org/b"/><summary>Text</summary><updated>2026-11-27T08:00:00Z</updated></entry></feed>`;
  assert.equal(parseRss(xml)[0].link, 'https://example.org/b');
});

test('Mastodon: erster Satz wird Titel', () => {
  const xml = `<rss><item><link>https://social.example/1</link><description>&lt;p&gt;💬 Heute tagt die Bürgerschaft zum Haushalt. Weitere Infos folgen.&lt;/p&gt;</description><pubDate>Fri, 27 Nov 2026 10:00:00 +0000</pubDate></item></rss>`;
  assert.equal(parseMastodon(xml)[0].titel, 'Heute tagt die Bürgerschaft zum Haushalt.');
});

test('Fraktions-Liste (TYPO3)', () => {
  const html = `<div class="xBlogItem i1"><div class="main top"><h2><a href="/presse/pm/x">
Bremens neues Zentrum
</a></h2><p class="short"><a href="/presse/pm/x"><span class="xblog-meta"><span class="datetime">20.11.26</span><span class="xblog-dash"> - </span></span>
Grün gebaut</a></p></div></div>`;
  const [it] = parseTypo3Liste(html, 'https://gruene-fraktion-bremen.de/presse/pressemitteilungen');
  assert.equal(it.titel, 'Bremens neues Zentrum');
  assert.equal(it.link, 'https://gruene-fraktion-bremen.de/presse/pm/x');
  assert.equal(it.datum.slice(0, 10), '2026-11-20');
  assert.equal(it.teaser, 'Grün gebaut');
});

test('ICS mit gefalteten Zeilen', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:LAG Umwelt\r\nDTSTART;TZID=Europe/Berlin:20261203T173000\r\nLOCATION:Grüne Landes\r\n geschäftsstelle\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const [t] = parseIcs(ics);
  assert.deepEqual([t.titel, t.start, t.ort], ['LAG Umwelt', '2026-12-03T17:30:00', 'Grüne Landesgeschäftsstelle']);
});

test('reinerText entfernt HTML', () => assert.equal(reinerText('<b>a</b>&nbsp;b'), 'a b'));

const themen = JSON.parse(await readFile(new URL('../config/themen.json', import.meta.url)));
const regeln = kompiliereRegeln(themen);

test('Relevanz: Umwelt + Grünen-Bezug = Hoch mit Begründung', () => {
  const r = bewerte({ titel: 'Starkregen: Grüne fordern mehr Schwammstadt', teaser: 'Der Senat soll Entsiegelung fördern.' }, regeln);
  assert.equal(r.themenfeld, 'umwelt');
  assert.equal(r.label, 'Hoch');
  assert.match(r.begruendung, /Themenfeld Umwelt/);
  assert.match(r.begruendung, /Starkregen/);
  assert.match(r.begruendung, /Grünen-Bezug/);
});

test('Relevanz: Ausschlusswort', () => {
  assert.equal(bewerte({ titel: 'Werder Bremen siegt', teaser: '' }, regeln).ausgeschlossen, true);
});

test('Relevanz: Überlappende Stichwörter zählen einmal', () => {
  const a = bewerte({ titel: 'Jugend', teaser: '' }, regeln).score;
  const b = bewerte({ titel: 'Jugendliche', teaser: '' }, regeln).score;
  assert.equal(a, b);
});

test('Clustering: ähnliche Titel aus 2 Quellen', () => {
  const m = (id, quelle, titel) => ({ id, quelle, titel, teaser: '', datum: '2026-11-27T10:00:00Z', score: 50 });
  const c = clustere([m('1', 'A', 'Senat beschließt Haushalt für Kitas'), m('2', 'B', 'Senat beschließt Kita-Haushalt für Kitas'), m('3', 'B', 'Werft in Bremerhaven')]);
  assert.equal(c.length, 2);
  assert.equal(c[0].quellen.size, 2);
});

console.log(`\n${ok} Tests bestanden.`);
