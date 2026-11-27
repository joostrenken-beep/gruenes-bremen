#!/usr/bin/env node
// Lädt alle aktiven Feeds aus config/feeds.json, bewertet die Meldungen
// regelbasiert und schreibt data/news.json (+ data/termine-auto.json).
// Keine npm-Pakete nötig – läuft mit Node 20+.

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { kompiliereRegeln, bewerte } from '../js/relevanz.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...x) => path.join(ROOT, ...x);
const UA = 'GruenesBremenNews/1.0 (privater Feed-Leser; github.com)';
const TAGE_BEHALTEN = 30;
const MAX_MELDUNGEN = 800;

const lies = async (datei, fallback) => {
  try { return JSON.parse(await readFile(p(datei), 'utf8')); } catch { return fallback; }
};

// ---------- Hilfsfunktionen ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '', ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', sbquo: '‚', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', euro: '€' };
export function entities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e] ?? m;
  });
}
const cdata = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
export function reinerText(html) {
  let s = entities(cdata(html)); // Feeds sind oft doppelt kodiert
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return entities(s).replace(/\s+/g, ' ').trim();
}
const kuerze = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s);
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};
const idFuer = (link, titel) => createHash('sha1').update(link || titel).digest('hex').slice(0, 12);

function datumOderJetzt(s) {
  const d = new Date(String(s || '').trim());
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

async function lade(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, text/calendar, */*' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ---------- Parser ----------
export function parseRss(xml) {
  const items = [];
  const bloecke = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of bloecke) {
    let link = reinerText(tag(b, 'link'));
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*>/i) || b.match(/<link[^>]*>/i);
      const href = alt && alt[0].match(/href=["']([^"']+)["']/i);
      link = href ? entities(href[1]) : '';
    }
    if (!link) link = reinerText(tag(b, 'guid'));
    items.push({
      titel: reinerText(tag(b, 'title')),
      teaser: kuerze(reinerText(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')), 320),
      datum: datumOderJetzt(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date')),
      link,
    });
  }
  return items;
}

// Mastodon-Beiträge haben keinen Titel -> erster Satz wird zum Titel
export function parseMastodon(xml) {
  return parseRss(xml).map((it) => {
    const text = it.teaser.replace(/^[^\p{L}\p{N}]+/u, '');
    const satz = (text.match(/^.{20,140}?[.!?](\s|$)/u) || [text.slice(0, 120)])[0].trim();
    return { ...it, titel: kuerze(satz, 140), teaser: kuerze(text, 320) };
  });
}

// Pressemitteilungs-Liste (TYPO3 GRÜNE "xBlog") der Grünen Fraktion
export function parseTypo3Liste(html, basis) {
  const items = [];
  const bloecke = html.split(/class="xBlogItem/).slice(1);
  for (const b of bloecke) {
    const a = b.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    const d = b.match(/class="datetime">\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    let datum = new Date().toISOString();
    if (d) {
      const jahr = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
      datum = new Date(Date.UTC(jahr, Number(d[2]) - 1, Number(d[1]), 10)).toISOString();
    }
    const kurz = b.match(/<p class="short">([\s\S]*?)<\/p>/i);
    const teaser = kurz ? reinerText(kurz[1].replace(/<span class="xblog-meta">[\s\S]*?<\/span>\s*<\/span>/i, '')) : '';
    items.push({ titel: reinerText(a[2]), teaser: kuerze(teaser, 320), datum, link: new URL(entities(a[1]), basis).href });
  }
  return items;
}

// iCalendar (.ics) -> Termine
export function parseIcs(ics) {
  const zeilen = ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const termine = [];
  let akt = null;
  for (const z of zeilen) {
    if (z === 'BEGIN:VEVENT') akt = {};
    else if (z === 'END:VEVENT') { if (akt && akt.titel && akt.start) termine.push(akt); akt = null; }
    else if (akt) {
      const i = z.indexOf(':');
      if (i < 0) continue;
      const [schluessel] = z.slice(0, i).split(';');
      const wert = z.slice(i + 1).replace(/\\n/g, ' ').replace(/\\([,;\\])/g, '$1').trim();
      if (schluessel === 'SUMMARY') akt.titel = wert;
      else if (schluessel === 'LOCATION') akt.ort = wert;
      else if (schluessel === 'URL') akt.link = wert;
      else if (schluessel === 'DTSTART') akt.start = icsDatum(wert);
      else if (schluessel === 'DTEND') akt.ende = icsDatum(wert);
    }
  }
  return termine;
}
// 20261130T180000 (Ortszeit Berlin) -> "2026-11-30T18:00:00" ; ...Z -> ISO UTC
function icsDatum(w) {
  const m = w.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, J, M, T, h = '00', mi = '00', s = '00', z] = m;
  if (z) return new Date(Date.UTC(+J, +M - 1, +T, +h, +mi, +s)).toISOString();
  return `${J}-${M}-${T}T${h}:${mi}:${s}`; // lokale Zeit (Europe/Berlin)
}

// ---------- Hauptprogramm ----------
async function main() {
  const config = await lies('config/feeds.json', { feeds: [] });
  const themen = await lies('config/themen.json', null);
  if (!themen) throw new Error('config/themen.json fehlt oder ist kein gültiges JSON');
  const regeln = kompiliereRegeln(themen);
  const alt = await lies('data/news.json', { meldungen: [] });
  const altNachId = new Map((alt.meldungen || []).map((m) => [m.id, m]));

  const status = [];
  const neu = [];
  for (const feed of config.feeds.filter((f) => f.aktiv)) {
    try {
      const roh = await lade(feed.url);
      const items = feed.typ === 'mastodon' ? parseMastodon(roh) : feed.typ === 'typo3-liste' ? parseTypo3Liste(roh, feed.url) : parseRss(roh);
      let anzahl = 0;
      for (const it of items) {
        if (!it.titel || !it.link) continue;
        const id = idFuer(it.link, it.titel);
        const vorher = altNachId.get(id);
        const m = { id, titel: it.titel, teaser: it.teaser, datum: it.datum, quelle: feed.name, quelleId: feed.id, link: it.link, erfasst: vorher?.erfasst || new Date().toISOString() };
        Object.assign(m, bewerte(m, regeln, feed.bonus || 0));
        neu.push(m);
        anzahl++;
      }
      status.push({ id: feed.id, name: feed.name, ok: true, anzahl });
      console.log(`✔ ${feed.name}: ${anzahl} Meldungen`);
    } catch (e) {
      status.push({ id: feed.id, name: feed.name, ok: false, fehler: String(e.message || e) });
      console.warn(`✘ ${feed.name}: ${e.message || e}`);
    }
  }

  if (!status.some((s) => s.ok)) {
    console.error('Keine einzige Quelle erreichbar – news.json bleibt unverändert.');
    process.exitCode = 1;
    return;
  }

  // Zusammenführen: neue Daten gewinnen, alte bleiben bis 30 Tage erhalten (neu bewertet)
  const grenze = Date.now() - TAGE_BEHALTEN * 864e5;
  const nachId = new Map();
  for (const m of alt.meldungen || []) {
    if (new Date(m.datum).getTime() < grenze) continue;
    const feed = config.feeds.find((f) => f.id === m.quelleId);
    nachId.set(m.id, { ...m, ...bewerte(m, regeln, feed?.bonus || 0) });
  }
  for (const m of neu) nachId.set(m.id, m);
  const meldungen = [...nachId.values()]
    .filter((m) => new Date(m.datum).getTime() >= grenze)
    .sort((a, b) => new Date(b.datum) - new Date(a.datum))
    .slice(0, MAX_MELDUNGEN);

  await writeFile(p('data/news.json'), JSON.stringify({ stand: new Date().toISOString(), quellen: status, meldungen }, null, 1) + '\n');
  console.log(`→ data/news.json: ${meldungen.length} Meldungen`);

  // Termine aus Kalendern
  const termine = [];
  const kalStatus = [];
  for (const k of (config.kalender || []).filter((k) => k.aktiv)) {
    try {
      const t = parseIcs(await lade(k.url));
      const heute = new Date().toISOString().slice(0, 10);
      for (const x of t) if (x.start.slice(0, 10) >= heute) termine.push({ ...x, quelle: k.name });
      kalStatus.push({ id: k.id, name: k.name, ok: true, anzahl: t.length });
      console.log(`✔ Kalender ${k.name}: ${t.length} Termine`);
    } catch (e) {
      kalStatus.push({ id: k.id, name: k.name, ok: false, fehler: String(e.message || e) });
      console.warn(`✘ Kalender ${k.name}: ${e.message || e}`);
    }
  }
  if (kalStatus.some((s) => s.ok)) {
    termine.sort((a, b) => a.start.localeCompare(b.start));
    await writeFile(p('data/termine-auto.json'), JSON.stringify({ stand: new Date().toISOString(), quellen: kalStatus, termine }, null, 1) + '\n');
    console.log(`→ data/termine-auto.json: ${termine.length} kommende Termine`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
