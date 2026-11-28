// Grünes Bremen – Lage & Mitmachen
// Vanilla JS, keine Frameworks. Alle persönlichen Daten bleiben im Browser (localStorage).

import { kompiliereRegeln, bewerte, clustere, labelFuer, stichwortRegex } from './relevanz.js';

// ============ Hilfen ============
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tageMs = 864e5;

const store = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem('gb.' + k);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('gb.' + k, JSON.stringify(v));
      return true;
    } catch {
      toast('Speichern im Browser nicht möglich (privater Modus?)');
      return false;
    }
  },
  del(k) {
    try { localStorage.removeItem('gb.' + k); } catch { /* egal */ }
  },
};

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

async function kopieren(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignorieren */ }
    ta.remove();
  }
  toast('In die Zwischenablage kopiert');
}

function herunterladen(dateiname, inhalt, typ) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONAT = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const zwei = (n) => String(n).padStart(2, '0');
const datumKurz = (d) => `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.`;
const datumLang = (d) => `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
const uhrzeit = (d) => `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
const heuteISO = () => { const d = new Date(); return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`; };

function relativ(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60e3) return 'gerade eben';
  if (diff < 3600e3) return `vor ${Math.round(diff / 60e3)} Min.`;
  const mitternacht = new Date(); mitternacht.setHours(0, 0, 0, 0);
  if (d >= mitternacht) return `vor ${Math.round(diff / 3600e3)} Std.`;
  if (d >= new Date(mitternacht.getTime() - tageMs)) return `gestern, ${uhrzeit(d)}`;
  return `${WOCHENTAG[d.getDay()]} ${datumKurz(d)}`;
}

const ICON = {
  merken: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>',
  gemerkt: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4V4Z"/></svg>',
  gelesen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  pfeil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  zurueck: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m6 6-6-6 6-6"/></svg>',
  kopie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  kalender: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4m6-4v4"/></svg>',
  extern: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  filter: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  suche: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

// ============ Zustand ============
const S = {
  basis: { themen: null, vorlagen: null, feeds: null },
  news: { meldungen: [], quellen: [], stand: null },
  gremien: [],
  termine: [],
  kontakte: [],
  cluster: [],
  nachId: new Map(),
  regeln: null,
  detailTab: 'beitrag',
  vorlageId: null,
};

const STANDARD_FILTER = { zeitraum: '7', themenfeld: '', relevanz: '', quelle: '', suche: '', ohneGelesene: false, sortierung: 'relevanz', stichwoerter: [] };
const filter = { ...STANDARD_FILTER, ...store.get('filter', {}), suche: '' };
if (!Array.isArray(filter.stichwoerter)) filter.stichwoerter = [];
const STANDARD_PROFIL = { name: '', fachprofil: 'Bauingenieur, Erfahrung in Stadtentwässerung und Starkregenvorsorge', rolle: '' };

const themen = () => store.get('themen', null) || S.basis.themen;
const vorlagen = () => store.get('vorlagen', null) || S.basis.vorlagen;
const profil = () => ({ ...STANDARD_PROFIL, ...store.get('profil', {}) });
const gemerkt = () => store.get('gemerkt', {});
const gelesen = () => new Set(store.get('gelesen', []));
const logbuch = () => store.get('log', []);

function themenfeldName(id, lang = false) {
  const tf = themen().themenfelder.find((t) => t.id === id);
  return tf ? (lang ? tf.lang || tf.name : tf.name) : 'Sonstiges';
}

// ============ Daten laden ============
async function ladeJSON(url, fallback) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch {
    return fallback;
  }
}

async function ladeAlles() {
  const [th, vo, fe, news, gr, ter, terAuto, ko] = await Promise.all([
    ladeJSON('config/themen.json', null),
    ladeJSON('config/vorlagen.json', { vorlagen: [], claudePrompt: '' }),
    ladeJSON('config/feeds.json', { feeds: [] }),
    ladeJSON('data/news.json', { meldungen: [], quellen: [] }),
    ladeJSON('data/gremien.json', { gremien: [] }),
    ladeJSON('data/termine.json', { termine: [] }),
    ladeJSON('data/termine-auto.json', { termine: [] }),
    ladeJSON('data/kontakte.json', { kontakte: [] }),
  ]);
  S.basis.themen = th || { themenfelder: [], boost: {}, ausschluss: [] };
  S.basis.vorlagen = vo;
  S.basis.feeds = fe;
  S.news = news;
  S.gremien = gr.gremien || [];
  S.kontakte = ko.kontakte || [];
  const eigene = (ter.termine || []).map((t) => ({ ...t, eigen: true }));
  S.termine = [...eigene, ...(terAuto.termine || [])]
    .filter((t) => t.start && new Date(t.start).getTime() > Date.now() - 3600e3)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  for (const t of S.termine) t.gremien = gremienFuerTermin(t);
  neuBewerten();
}

// Bewertet alle Meldungen mit den (ggf. lokal geänderten) Stichwörtern neu.
function neuBewerten() {
  S.regeln = kompiliereRegeln(themen());
  const bonus = new Map((S.basis.feeds.feeds || []).map((f) => [f.id, f.bonus || 0]));
  const meldungen = (S.news.meldungen || []).map((m) => ({ ...m, ...bewerte(m, S.regeln, bonus.get(m.quelleId) || 0) }));
  S.ausgeschlossen = meldungen.filter((m) => m.ausgeschlossen).length;
  S.cluster = clustere(meldungen.filter((m) => !m.ausgeschlossen)).map((c) => {
    const alle = [c.haupt, ...c.weitere];
    const quellen = [...c.quellen];
    return {
      id: c.haupt.id,
      haupt: c.haupt,
      alle,
      quellen,
      score: c.score,
      label: labelFuer(c.score, S.regeln),
      themenfeld: c.haupt.themenfeld,
      datum: alle.map((m) => m.datum).sort().pop(),
      treffer: [...new Set(alle.flatMap((m) => m.treffer || []))],
      begruendung: c.haupt.begruendung,
      text: alle.map((m) => `${m.titel} ${m.teaser} ${m.quelle}`).join(' ').toLowerCase(),
      inhalt: alle.map((m) => `${m.titel} ${m.teaser}`).join(' ').toLowerCase(),
    };
  });
  S.nachId = new Map();
  for (const c of S.cluster) for (const m of c.alle) S.nachId.set(m.id, c);
}

// ============ Filter ============
function zeitGrenze(z) {
  if (z === 'heute') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  return Date.now() - Number(z || 30) * tageMs;
}

// Alle Stichwörter aus den Themenfeldern (+ Grünen-Bezug) als Filter-Kategorien
const reCache = new Map();
function reFuer(wort) {
  if (!reCache.has(wort)) reCache.set(wort, stichwortRegex(wort));
  return reCache.get(wort);
}
const anzeigeName = (w) => { const x = String(w).replace(/^\*/, ''); return x.charAt(0).toUpperCase() + x.slice(1); };

// Zählt, wie viele Themen jedes Stichwort treffen (in der übergebenen Auswahl).
function stichwortStatistik(cl) {
  const gruppen = [
    ...themen().themenfelder.map((t) => ({ id: t.id, name: t.name, woerter: Object.keys(t.stichwoerter || {}) })),
    { id: 'boost', name: 'Grünen-Bezug', woerter: Object.keys(themen().boost || {}) },
  ];
  return gruppen.map((g) => ({
    ...g,
    woerter: g.woerter
      .map((w) => ({ wort: w, name: anzeigeName(w), n: cl.filter((c) => reFuer(w)?.test(c.inhalt)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
  }));
}

function passtStichwort(c) {
  if (!filter.stichwoerter.length) return true;
  return filter.stichwoerter.some((w) => reFuer(w)?.test(c.inhalt));
}

function gefiltert({ ohneThemenfeld = false, ohneStichwoerter = false } = {}) {
  const grenze = zeitGrenze(filter.zeitraum);
  const woerter = filter.suche.toLowerCase().split(/\s+/).filter(Boolean);
  const gel = gelesen();
  let liste = S.cluster.filter((c) => {
    if (new Date(c.datum).getTime() < grenze) return false;
    if (!ohneThemenfeld && filter.themenfeld && c.themenfeld !== filter.themenfeld) return false;
    if (filter.relevanz && c.label !== filter.relevanz) return false;
    if (filter.quelle && !c.quellen.includes(filter.quelle)) return false;
    if (filter.ohneGelesene && c.alle.some((m) => gel.has(m.id))) return false;
    if (!ohneStichwoerter && !passtStichwort(c)) return false;
    if (woerter.length && !woerter.every((w) => c.text.includes(w))) return false;
    return true;
  });
  liste.sort(filter.sortierung === 'neueste'
    ? (a, b) => new Date(b.datum) - new Date(a.datum)
    : (a, b) => b.score - a.score || new Date(b.datum) - new Date(a.datum));
  return liste;
}

const filterAnzahl = () =>
  (filter.relevanz ? 1 : 0) + (filter.quelle ? 1 : 0) + filter.stichwoerter.length + (filter.ohneGelesene ? 1 : 0) + (filter.zeitraum !== '7' ? 1 : 0);

function top3() {
  for (const stunden of [24, 48, 96]) {
    const grenze = Date.now() - stunden * 3600e3;
    const kandidaten = S.cluster.filter((c) => new Date(c.datum).getTime() >= grenze).sort((a, b) => b.score - a.score);
    if (kandidaten.length >= 3 || stunden === 96) return kandidaten.slice(0, 3);
  }
  return [];
}

// ============ Meldungen (Darstellung) ============
function relevanzAnzeige(c) {
  return `<span class="score score-${esc(c.label)}" title="Relevanz ${c.score} von 100"><span class="score-label">${esc(c.label)}</span><span class="score-balken"><i style="width:${c.score}%"></i></span><span class="score-zahl">${c.score}</span></span>`;
}

function karte(c, { rang = 0, voll = false, gross = false } = {}) {
  const gel = gelesen();
  const istGelesen = c.alle.some((m) => gel.has(m.id));
  const istGemerkt = istGemerktCluster(c);
  const m = c.haupt;
  const quellenText = c.quellen.length > 1 ? ` · <b>${c.quellen.length} Quellen</b>` : '';
  return `
  <article class="meldung ${gross ? 'aufmacher' : ''} ${rang && !gross ? 'neben' : ''} ${voll ? 'voll' : ''} ${istGelesen && !voll ? 'gelesen' : ''}" data-id="${esc(c.id)}">
    ${rang && !gross ? `<span class="rangzahl" aria-hidden="true">${rang}</span>` : ''}
    <div class="meldung-inhalt">
      <div class="kicker">
        <button type="button" class="ressort tf-${esc(c.themenfeld)}" data-f-themenfeld="${esc(c.themenfeld)}" title="Nur ${esc(themenfeldName(c.themenfeld))} zeigen">${esc(themenfeldName(c.themenfeld))}</button>
        ${relevanzAnzeige(c)}
      </div>
      <h3><a href="${esc(m.link)}" target="_blank" rel="noopener" data-act="oeffnen">${esc(m.titel)}</a></h3>
      ${m.teaser && (gross || voll || !rang) ? `<p class="teaser">${esc(m.teaser)}</p>` : ''}
      <p class="warum">${esc(c.begruendung)}</p>
      <div class="fuss">
        <span class="herkunft">${esc(m.quelle)} · ${esc(relativ(c.datum))}${quellenText}</span>
        ${voll ? '' : `
        <span class="werkzeuge">
          <button class="icon-knopf" type="button" data-act="merken" aria-pressed="${istGemerkt}" aria-label="${istGemerkt ? 'Gemerkt – entfernen' : 'Merken'}">${istGemerkt ? ICON.gemerkt : ICON.merken}</button>
          <button class="icon-knopf" type="button" data-act="gelesen" aria-pressed="${istGelesen}" aria-label="${istGelesen ? 'Als ungelesen markieren' : 'Als gelesen markieren'}">${ICON.gelesen}</button>
          <a class="mitmachen-link" href="#/m/${esc(c.id)}">Mitmachen ${ICON.pfeil}</a>
        </span>`}
      </div>
    </div>
  </article>`;
}

// ============ Ansicht: Lage (Startseite) ============
const WOCHENTAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function aktiveFilterTokens() {
  const t = [];
  if (filter.zeitraum !== '7') t.push(['zeitraum', filter.zeitraum === 'heute' ? 'Heute' : `${filter.zeitraum} Tage`]);
  if (filter.relevanz) t.push(['relevanz', `Relevanz ${filter.relevanz}`]);
  if (filter.quelle) t.push(['quelle', filter.quelle]);
  for (const w of filter.stichwoerter) t.push(['stichwort:' + w, anzeigeName(w)]);
  if (filter.ohneGelesene) t.push(['gelesen', 'ohne Gelesene']);
  return t;
}

function ansichtLage() {
  const liste = gefiltert();
  const filterAktiv = filter.suche || filter.themenfeld || filterAnzahl() > (filter.zeitraum !== '7' ? 1 : 0);
  const top = filterAktiv ? [] : top3();
  const topIds = new Set(top.map((c) => c.id));
  const rest = liste.filter((c) => !topIds.has(c.id));
  const heute = new Date();
  const proFeld = gefiltert({ ohneThemenfeld: true });
  const ressorts = [['', 'Alle'], ...themen().themenfelder.map((t) => [t.id, t.name]), ['sonstiges', 'Sonstiges']];
  const tokens = aktiveFilterTokens();
  const stand = S.news.stand ? new Date(S.news.stand) : null;

  return `
  <header class="masthead">
    <p class="dachzeile">${WOCHENTAG_LANG[heute.getDay()]}, ${heute.getDate()}. ${MONAT[heute.getMonth()]} ${heute.getFullYear()}</p>
    <h1>Die Lage</h1>
    <p class="unterzeile">${S.cluster.length} Themen aus ${(S.news.quellen || []).filter((q) => q.ok).length} Quellen${stand ? ` · aktualisiert ${esc(relativ(S.news.stand))}` : ''}</p>
  </header>

  ${top.length ? `
  <section class="titelseite" aria-label="Top 3 des Tages">
    <h2 class="rubrik">Top 3 des Tages</h2>
    ${karte(top[0], { rang: 1, gross: true })}
    <div class="nebenreihe">${top.slice(1).map((c, i) => karte(c, { rang: i + 2 })).join('')}</div>
  </section>` : ''}

  <section aria-label="Alle Meldungen" class="liste-bereich">
    <nav class="ressorts" aria-label="Themenfeld">
      ${ressorts.map(([id, name]) => {
        const n = id ? proFeld.filter((c) => c.themenfeld === id).length : proFeld.length;
        return `<button type="button" class="ressort-tab ${id ? 'tf-' + id : ''}" data-f-themenfeld="${esc(id)}" aria-pressed="${filter.themenfeld === id}">${esc(name)}<sup>${n}</sup></button>`;
      }).join('')}
    </nav>
    <div class="werkzeugleiste">
      <label class="suchfeld">${ICON.suche}<input type="search" id="f-suche" placeholder="Suchen" value="${esc(filter.suche)}" aria-label="Meldungen durchsuchen"></label>
      <button type="button" class="filter-knopf" data-act="sheet-auf" aria-haspopup="dialog">${ICON.filter}Filter${filterAnzahl() ? `<span class="badge">${filterAnzahl()}</span>` : ''}</button>
    </div>
    ${tokens.length ? `<div class="tokens">${tokens.map(([k, n]) => `<button type="button" class="token" data-f-entfernen="${esc(k)}" aria-label="Filter ${esc(n)} entfernen">${esc(n)}<span aria-hidden="true">×</span></button>`).join('')}<button type="button" class="token-reset" data-act="filter-reset">Alle entfernen</button></div>` : ''}
    <div class="listenkopf">
      <span>${liste.length} ${liste.length === 1 ? 'Thema' : 'Themen'}</span>
      <button type="button" class="text-knopf" data-sort>${filter.sortierung === 'neueste' ? 'Neueste zuerst' : 'Relevanteste zuerst'} ⇅</button>
    </div>
    <div id="liste">
      ${rest.length ? rest.map((c) => karte(c)).join('') : `<p class="leer">Keine Meldungen für diese Auswahl.${S.cluster.length ? '' : '<br>Noch keine Daten geladen – läuft die GitHub Action schon?'}</p>`}
    </div>
  </section>`;
}

// ============ Filter-Fenster (Bottom Sheet) ============
function sheetInhalt() {
  const quellen = [...new Set(S.cluster.flatMap((c) => c.quellen))].sort();
  const stat = stichwortStatistik(gefiltert({ ohneStichwoerter: true }));
  const treffer = gefiltert().length;
  const seg = (attr, optionen, aktuell) => `<div class="segment">${optionen.map(([w, n]) => `<button type="button" ${attr}="${esc(w)}" aria-pressed="${aktuell === w}">${esc(n)}</button>`).join('')}</div>`;
  return `
  <div class="sheet-kopf">
    <button type="button" class="text-knopf" data-act="filter-reset">Zurücksetzen</button>
    <h2>Filter</h2>
    <button type="button" class="fertig-knopf" data-act="sheet-zu">${treffer} zeigen</button>
  </div>
  <div class="sheet-koerper">
    <h3>Zeitraum</h3>
    ${seg('data-f-zeitraum', [['heute', 'Heute'], ['7', '7 Tage'], ['30', '30 Tage']], filter.zeitraum)}
    <h3>Relevanz</h3>
    ${seg('data-f-relevanz', [['', 'Alle'], ['Hoch', 'Hoch'], ['Mittel', 'Mittel'], ['Niedrig', 'Niedrig']], filter.relevanz)}
    <h3>Sortierung</h3>
    ${seg('data-f-sort', [['relevanz', 'Relevanz'], ['neueste', 'Neueste']], filter.sortierung)}
    <h3>Stichwörter <small>mehrere möglich · Zahl = passende Themen</small></h3>
    ${stat.filter((g) => g.woerter.length).map((g) => `
      <div class="stichwort-gruppe">
        <p class="gruppen-name ${g.id !== 'boost' ? 'tf-' + esc(g.id) : ''}">${esc(g.name)}</p>
        <div class="wortwolke">${g.woerter.map((w) => `<button type="button" class="wort" data-f-stichwort="${esc(w.wort)}" aria-pressed="${filter.stichwoerter.includes(w.wort)}">${esc(w.name)} <span>${w.n}</span></button>`).join('')}</div>
      </div>`).join('') || '<p class="hinweis">Im Zeitraum keine Treffer.</p>'}
    <h3>Quelle</h3>
    <div class="wortwolke">
      <button type="button" class="wort" data-f-quelle="" aria-pressed="${!filter.quelle}">Alle</button>
      ${quellen.map((q) => `<button type="button" class="wort" data-f-quelle="${esc(q)}" aria-pressed="${filter.quelle === q}">${esc(q)}</button>`).join('')}
    </div>
    <label class="umschalter"><span>Gelesene ausblenden</span><input type="checkbox" id="f-gelesen" ${filter.ohneGelesene ? 'checked' : ''}><i aria-hidden="true"></i></label>
  </div>`;
}

function sheetZeichnen() {
  const box = $('#sheet-inhalt');
  if (!box) return;
  const koerper = $('.sheet-koerper', box);
  const pos = koerper ? koerper.scrollTop : 0;
  box.innerHTML = sheetInhalt();
  const neu = $('.sheet-koerper', box);
  if (neu) neu.scrollTop = pos;
}
function sheetAuf() {
  const s = $('#sheet');
  sheetZeichnen();
  s.hidden = false;
  document.body.classList.add('sheet-offen');
  requestAnimationFrame(() => s.classList.add('offen'));
  $('.fertig-knopf', s)?.focus();
}
function sheetZu() {
  const s = $('#sheet');
  if (s.hidden) return;
  s.classList.remove('offen');
  document.body.classList.remove('sheet-offen');
  setTimeout(() => { s.hidden = true; }, 220);
}

// ============ Ansicht: Detail + Mitmachen ============
function passendeGremien(c) {
  return S.gremien
    .map((g) => {
      let punkte = (g.themenfelder || []).includes(c.themenfeld) ? 2 : 0;
      for (const w of g.stichwoerter || []) { const re = stichwortRegex(w); if (re && re.test(c.inhalt)) punkte += 1.5; }
      return { g, punkte };
    })
    .filter((x) => x.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte)
    .map((x) => x.g);
}

function passendeKontakte(c) {
  return S.kontakte
    .map((k) => {
      let punkte = (k.themenfelder || []).includes(c.themenfeld) ? 1 : 0;
      for (const w of k.stichwoerter || []) { const re = stichwortRegex(w); if (re && re.test(c.inhalt)) punkte += 2; }
      return { k, punkte };
    })
    .filter((x) => x.punkte > 0)
    .sort((a, b) => b.punkte - a.punkte)
    .map((x) => x.k);
}

function gremienFuerTermin(t) {
  if (t.gremium) return [t.gremium];
  const titel = (t.titel || '').toLowerCase();
  return S.gremien
    .filter((g) => (g.kalender || []).some((k) => new RegExp(`(^|[^a-zäöüß])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-zäöüß])`, 'u').test(titel)))
    .map((g) => g.id);
}

function platzhalter(c) {
  const p = profil();
  const m = c.haupt;
  const gremium = passendeGremien(c)[0];
  const hashtags = ['#Bremen', ...c.treffer.slice(0, 3).map((t) => '#' + t.replace(/[^A-Za-z0-9ÄÖÜäöüß]/g, ''))]
    .filter((h, i, a) => h.length > 2 && a.findIndex((x) => x.toLowerCase() === h.toLowerCase()) === i)
    .join(' ');
  return {
    titel: m.titel,
    quelle: c.quellen.join(', '),
    link: m.link,
    datum: datumLang(new Date(m.datum)),
    teaser: m.teaser || '',
    themenfeld: themenfeldName(c.themenfeld, true),
    treffer: c.treffer.join(', ') || '–',
    hashtags,
    name: p.name || '[Name]',
    fachprofil: p.fachprofil || '[Fachprofil]',
    rolle: p.rolle || '',
    gremium: gremium ? gremium.name : 'zuständigen LAG',
  };
}
const fuelle = (text, werte) => String(text || '').replace(/\{(\w+)\}/g, (all, k) => (k in werte ? werte[k] : all));

function terminZeile(t) {
  const d = new Date(t.start);
  const gr = (t.gremien || []).map((id) => S.gremien.find((g) => g.id === id)?.name).filter(Boolean);
  return `
  <li class="termin">
    <div class="datum-box"><small>${WOCHENTAG[d.getDay()]}</small><b>${d.getDate()}.</b><small>${MONAT[d.getMonth()].slice(0, 3)}</small></div>
    <div>
      <div class="titel">${t.link ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">${esc(t.titel)}</a>` : esc(t.titel)}</div>
      <div class="unter">${uhrzeit(d)} Uhr${t.ort ? ' · ' + esc(t.ort) : ''}${gr.length ? ' · ' + esc(gr.join(', ')) : ''}</div>
    </div>
    <button class="btn klein" type="button" data-act="ics" data-termin="${esc(S.termine.indexOf(t))}" aria-label="Termin ${esc(t.titel)} als Kalenderdatei laden">${ICON.kalender}.ics</button>
  </li>`;
}

function ansichtDetail(id) {
  const c = S.nachId.get(id) || S.cluster.find((x) => x.id === id);
  if (!c) {
    const g = gemerkt()[id];
    return `<a class="zurueck" href="#/">${ICON.zurueck} Zurück</a>
      <p class="leer">Diese Meldung ist nicht mehr in den aktuellen Daten (älter als 30 Tage).${g ? `<br><a href="${esc(g.link)}" target="_blank" rel="noopener">${esc(g.titel)}</a>` : ''}</p>`;
  }
  const tab = S.detailTab;
  const tabs = [['beitrag', 'Beitrag'], ['gremien', 'Gremien & Termine'], ['kontakte', 'Ansprechpartner'], ['notieren', 'Notieren']];
  let panel = '';

  if (tab === 'beitrag') {
    const vl = vorlagen().vorlagen || [];
    const aktiv = vl.find((v) => v.id === S.vorlageId) || vl[0];
    const schluessel = `${c.id}:${aktiv?.id}`;
    const entwurf = store.get('entwuerfe', {})[schluessel] ?? fuelle(aktiv?.text, platzhalter(c));
    panel = `
    <div class="panel">
      <div class="chips" role="group" aria-label="Vorlage">
        ${vl.map((v) => `<button class="chip" type="button" data-vorlage="${esc(v.id)}" aria-pressed="${v.id === aktiv?.id}">${esc(v.name)}</button>`).join('')}
      </div>
      <textarea id="entwurf" class="entwurf" data-schluessel="${esc(schluessel)}" aria-label="Beitragsentwurf" style="margin-top:10px">${esc(entwurf)}</textarea>
      <div class="btn-reihe">
        <button class="btn primaer" type="button" data-act="kopieren" style="margin-left:0">${ICON.kopie}Kopieren</button>
        <button class="btn" type="button" data-act="prompt">${ICON.kopie}Prompt für Claude kopieren</button>
        <button class="btn" type="button" data-act="vorlage-neu">Vorlage neu einsetzen</button>
      </div>
      <p class="hinweis">Platzhalter sind schon gefüllt. Ergänze die Stellen in [eckigen Klammern]. Dein Fachprofil pflegst du in den Einstellungen. Änderungen am Text werden automatisch gemerkt.</p>
    </div>`;
  } else if (tab === 'gremien') {
    const gr = passendeGremien(c).slice(0, 5);
    const ids = new Set(gr.map((g) => g.id));
    const termine = S.termine.filter((t) => (t.gremien || []).some((x) => ids.has(x))).slice(0, 6);
    panel = `
    <div class="panel">
      <h3>Nächste passende Termine</h3>
      ${termine.length ? `<ul class="liste">${termine.map(terminZeile).join('')}</ul>` : '<p class="hinweis">Keine kommenden Termine der passenden Gremien gefunden.</p>'}
    </div>
    <div class="panel">
      <h3>Passende Gremien</h3>
      ${gr.length ? `<ul class="liste">${gr.map((g) => `
        <li>
          <div class="zeile-zwischen"><span class="titel">${esc(g.name)}</span>${g.status ? `<span class="status">${esc(g.status)}</span>` : ''}</div>
          ${g.beschreibung ? `<div class="unter">${esc(g.beschreibung)}</div>` : ''}
          ${g.turnus ? `<div class="unter">Treffen: ${esc(g.turnus)}</div>` : ''}
          ${g.sprecher?.length ? `<div class="unter">Sprecher*innen: ${esc(g.sprecher.join(', '))}</div>` : ''}
          <div class="btn-reihe">
            ${g.kontakt ? `<a class="btn klein" href="mailto:${esc(g.kontakt)}">E-Mail</a>` : ''}
            ${g.link ? `<a class="btn klein" href="${esc(g.link)}" target="_blank" rel="noopener">${ICON.extern}Webseite</a>` : ''}
          </div>
        </li>`).join('')}</ul>` : '<p class="hinweis">Kein Gremium passt automatisch. Pflege Stichwörter in data/gremien.json.</p>'}
    </div>`;
  } else if (tab === 'kontakte') {
    const ko = passendeKontakte(c).slice(0, 5);
    panel = `
    <div class="panel">
      ${ko.length ? `<ul class="liste">${ko.map((k) => `
        <li>
          <div class="zeile-zwischen"><span class="titel">${esc(k.name)}</span>${k.status ? `<span class="status">${esc(k.status)}</span>` : ''}</div>
          <div class="unter">${esc(k.rolle)}${k.fachgebiete?.length ? ' · ' + esc(k.fachgebiete.join(', ')) : ''}</div>
          <div class="btn-reihe">
            ${k.email ? `<a class="btn klein" href="mailto:${esc(k.email)}">E-Mail</a>` : ''}
            ${k.telefon ? `<a class="btn klein" href="tel:${esc(k.telefon.replace(/\s/g, ''))}">Anrufen</a>` : ''}
            ${k.profil ? `<a class="btn klein" href="${esc(k.profil)}" target="_blank" rel="noopener">${ICON.extern}Profil</a>` : ''}
          </div>
          <div class="unter" style="font-size:.75rem">Quelle: <a href="${esc(k.quelle_url)}" target="_blank" rel="noopener">${esc(new URL(k.quelle_url).hostname)}</a> · Stand ${esc(k.stand)}</div>
        </li>`).join('')}</ul>` : '<p class="hinweis">Keine passenden Ansprechpartner gefunden.</p>'}
      <p class="hinweis">Nur öffentliche, offizielle Angaben. Prüfe vor der Kontaktaufnahme, ob die Zuständigkeit noch aktuell ist.</p>
    </div>`;
  } else {
    panel = `<div class="panel">${logFormular(c)}</div>`;
  }

  return `
  <a class="zurueck" href="#/" data-act="zurueck">${ICON.zurueck} Zurück</a>
  ${karte(c, { voll: true })}
  <div class="aktionen">
    <a class="btn" href="${esc(c.haupt.link)}" target="_blank" rel="noopener" data-act="oeffnen">${ICON.extern}Originalartikel</a>
    <button class="btn" type="button" data-act="merken" data-id="${esc(c.id)}" aria-pressed="${istGemerktCluster(c)}">${istGemerktCluster(c) ? ICON.gemerkt + 'Gemerkt' : ICON.merken + 'Merken'}</button>
  </div>
  ${c.alle.length > 1 ? `
    <ul class="quellenliste">${c.alle.map((m) => `<li><a href="${esc(m.link)}" target="_blank" rel="noopener">${esc(m.titel)}</a> <span class="meta" style="display:inline">– ${esc(m.quelle)}, ${esc(relativ(m.datum))}</span></li>`).join('')}</ul>` : ''}

  <div class="abschnitt"><h2>Mitmachen</h2></div>
  <div class="tabs" role="tablist">
    ${tabs.map(([t, n]) => `<button type="button" role="tab" data-tab="${t}" aria-selected="${t === tab}">${n}</button>`).join('')}
  </div>
  <div data-id="${esc(c.id)}">${panel}</div>`;
}

// ============ Engagement-Log ============
const LOG_TYPEN = ['Post', 'Leserbrief', 'Termin besucht', 'Kontakt aufgenommen', 'Beitrag intern', 'Sonstiges'];

function logFormular(c, typ = 'Post') {
  return `
  <form id="log-form" data-meldung="${esc(c?.id || '')}">
    <div class="feld-reihe">
      <div class="feld"><label for="log-typ">Was hast du gemacht?</label>
        <select id="log-typ">${LOG_TYPEN.map((t) => `<option ${t === typ ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="feld"><label for="log-datum">Datum</label><input type="date" id="log-datum" value="${heuteISO()}" required></div>
    </div>
    <div class="feld"><label for="log-notiz">Notiz (optional)</label>
      <textarea id="log-notiz" rows="3" placeholder="z. B. LinkedIn-Post zu Starkregenvorsorge, 40 Reaktionen"></textarea></div>
    ${c ? `<p class="hinweis" style="margin:0 0 10px">Verknüpft mit: „${esc(c.haupt.titel)}“</p>` : ''}
    <button class="btn primaer" type="submit" style="margin-left:0">Im Engagement-Log speichern</button>
  </form>`;
}

function ansichtEngagement() {
  const log = logbuch().slice().sort((a, b) => b.datum.localeCompare(a.datum));
  const nachMonat = new Map();
  for (const e of log) {
    const k = e.datum.slice(0, 7);
    if (!nachMonat.has(k)) nachMonat.set(k, []);
    nachMonat.get(k).push(e);
  }
  const jetzt = new Date();
  const monate = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${zwei(d.getMonth() + 1)}`;
    monate.push({ k, name: MONAT[d.getMonth()].slice(0, 3), n: (nachMonat.get(k) || []).length });
  }
  const max = Math.max(1, ...monate.map((m) => m.n));
  const dieserMonat = nachMonat.get(monate[5].k) || [];
  const zaehle = (liste, t) => liste.filter((e) => e.typ === t).length;

  return `
  <div class="seitentitel"><h1>Mein Engagement</h1><p>Was du gemacht hast, wie aktiv und sichtbar du bist.</p></div>
  <div class="kacheln">
    <div class="kachel"><b>${dieserMonat.length}</b><span>Aktionen im ${MONAT[jetzt.getMonth()]}</span></div>
    <div class="kachel"><b>${zaehle(dieserMonat, 'Post') + zaehle(dieserMonat, 'Leserbrief')}</b><span>öffentlich sichtbar (Posts, Leserbriefe)</span></div>
    <div class="kachel"><b>${zaehle(dieserMonat, 'Termin besucht')}</b><span>Termine besucht</span></div>
    <div class="kachel"><b>${log.length}</b><span>insgesamt</span></div>
  </div>

  <div class="abschnitt"><h2>Letzte 6 Monate</h2></div>
  <div class="panel">
    ${monate.map((m) => `<div class="balken"><span>${m.name}</span><div class="spur"><div class="fuell" style="width:${(m.n / max) * 100}%"></div></div><span class="zahl">${m.n}</span></div>`).join('')}
  </div>

  <details class="panel" style="margin-top:12px" ${log.length ? '' : 'open'}>
    <summary>Neuen Eintrag hinzufügen</summary>
    ${logFormular(null)}
  </details>

  ${[...nachMonat.entries()].map(([k, eintraege]) => {
    const [j, mo] = k.split('-');
    const typen = LOG_TYPEN.map((t) => [t, zaehle(eintraege, t)]).filter(([, n]) => n).map(([t, n]) => `${n}× ${t}`).join(' · ');
    return `
    <section class="monat">
      <h3>${MONAT[Number(mo) - 1]} ${j} <span>${typen}</span></h3>
      <div class="panel"><ul class="liste">${eintraege.map((e) => `
        <li class="log-eintrag">
          <div>
            <div class="titel">${esc(e.typ)} <span class="meta" style="display:inline">· ${esc(datumLang(new Date(e.datum)))}</span></div>
            ${e.notiz ? `<div class="unter">${esc(e.notiz)}</div>` : ''}
            ${e.meldungTitel ? `<div class="unter">Zu: ${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener">${esc(e.meldungTitel)}</a>` : esc(e.meldungTitel)}</div>` : ''}
          </div>
          <button class="btn klein gefahr" type="button" data-act="log-loeschen" data-log="${esc(e.id)}" aria-label="Eintrag löschen">Löschen</button>
        </li>`).join('')}</ul></div>
    </section>`;
  }).join('')}`;
}

// ============ Gemerkt ============
function ansichtGemerkt() {
  const g = gemerkt();
  const eintraege = Object.entries(g).sort((a, b) => (b[1].gemerktAm || '').localeCompare(a[1].gemerktAm || ''));
  const gezeigt = new Set();
  return `
  <div class="seitentitel"><h1>Gemerkt</h1><p>${eintraege.length} Meldung${eintraege.length === 1 ? '' : 'en'} – bleiben auch nach 30 Tagen erhalten.</p></div>
  ${eintraege.length ? eintraege.map(([id, snap]) => {
    const c = S.nachId.get(id);
    if (c && gezeigt.has(c.id)) return '';
    if (c) { gezeigt.add(c.id); return karte(c); }
    return `<article class="karte" data-id="${esc(id)}">
      <div class="karte-kopf"><span class="tag tf-${esc(snap.themenfeld)}">${esc(themenfeldName(snap.themenfeld))}</span><span class="meta">archiviert</span></div>
      <h3><a href="${esc(snap.link)}" target="_blank" rel="noopener">${esc(snap.titel)}</a></h3>
      <div class="meta"><span>${esc(snap.quelle)}</span><span class="punkt">${esc(datumLang(new Date(snap.datum)))}</span></div>
      <div class="aktionen"><button class="btn" type="button" data-act="merken" aria-pressed="true">${ICON.gemerkt}Entfernen</button></div>
    </article>`;
  }).join('') : '<p class="leer">Noch nichts gemerkt. Tippe bei einer Meldung auf „Merken“.</p>'}`;
}

// ============ Themen-Übersicht ============
function ansichtThemen() {
  const grenze = Date.now() - 7 * tageMs;
  const cl = S.cluster.filter((c) => new Date(c.datum).getTime() >= grenze);
  const stat = stichwortStatistik(cl);
  const alle = stat.flatMap((g) => g.woerter.map((w) => ({ ...w, gruppe: g.id }))).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...alle.map((w) => w.n));
  const felder = [...themen().themenfelder.map((t) => t.id), 'sonstiges'].map((id) => ({ id, n: cl.filter((c) => c.themenfeld === id).length, hoch: cl.filter((c) => c.themenfeld === id && c.label === 'Hoch').length }));
  const balken = (w) => `<div class="balken"><button type="button" data-f-nur-stichwort="${esc(w.wort)}">${esc(w.name)}</button><div class="spur"><div class="fuell" style="width:${(w.n / max) * 100}%"></div></div><span class="zahl">${w.n}</span></div>`;
  return `
  <header class="masthead"><p class="dachzeile">Letzte 7 Tage · ${cl.length} Themen</p><h1>Themen der Woche</h1><p class="unterzeile">Tippe auf ein Themenfeld oder Stichwort, um die Lage danach zu filtern.</p></header>
  <div class="kennzahlen">
    ${felder.map((f) => `<button type="button" class="kennzahl tf-${f.id}" data-f-nur-themenfeld="${f.id}"><b>${f.n}</b><span class="kennzahl-name">${esc(themenfeldName(f.id))}</span><span>${f.hoch} hoch relevant</span></button>`).join('')}
  </div>
  <h2 class="rubrik">Häufigste Stichwörter</h2>
  <div class="balkenliste">${alle.length ? alle.slice(0, 25).map(balken).join('') : '<p class="hinweis">Noch keine Treffer.</p>'}</div>
  ${stat.filter((g) => g.woerter.length).map((g) => `
    <h2 class="rubrik ${g.id !== 'boost' ? 'tf-' + esc(g.id) : ''}">${esc(g.name)}</h2>
    <div class="wortwolke">${g.woerter.map((w) => `<button type="button" class="wort" data-f-nur-stichwort="${esc(w.wort)}">${esc(w.name)} <span>${w.n}</span></button>`).join('')}</div>`).join('')}`;
}

// ============ Einstellungen ============
const alsZeilen = (obj) => Object.entries(obj || {}).map(([w, g]) => `${w}: ${g}`).join('\n');
function ausZeilen(text) {
  const obj = {};
  for (const zeile of text.split('\n')) {
    const z = zeile.trim();
    if (!z) continue;
    const m = z.match(/^(.+?)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (m) obj[m[1].trim()] = Number(m[2].replace(',', '.'));
    else obj[z] = 1;
  }
  return obj;
}

function ansichtEinstellungen() {
  const p = profil();
  const th = themen();
  const vo = vorlagen();
  const eigeneThemen = !!store.get('themen', null);
  const eigeneVorlagen = !!store.get('vorlagen', null);
  const stand = S.news.stand ? new Date(S.news.stand) : null;
  const theme = store.get('darstellung', 'system');
  return `
  <div class="seitentitel"><h1>Einstellungen</h1><p>Alles wird nur in diesem Browser gespeichert. Mit Export/Import sicherst du es.</p></div>

  <details class="panel" open>
    <summary>Mein Profil</summary>
    <form id="profil-form">
      <div class="feld"><label for="p-name">Name (für Leserbriefe & Signatur)</label><input type="text" id="p-name" value="${esc(p.name)}" autocomplete="name"></div>
      <div class="feld"><label for="p-fach">Fachprofil</label><textarea id="p-fach" rows="2">${esc(p.fachprofil)}</textarea></div>
      <div class="feld"><label for="p-rolle">Rolle in der Partei (optional)</label><input type="text" id="p-rolle" value="${esc(p.rolle)}" placeholder="z. B. Sprecher einer LAG, Mitglied im Kreisverband …"></div>
      <div class="feld"><label for="p-theme">Darstellung</label>
        <select id="p-theme">${[['system', 'wie System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([w, n]) => `<option value="${w}" ${w === theme ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <button class="btn primaer" type="submit" style="margin-left:0">Profil speichern</button>
    </form>
  </details>

  <details class="panel">
    <summary>Stichwörter & Gewichtung ${eigeneThemen ? '<span class="status">angepasst</span>' : ''}</summary>
    <form id="themen-form">
      <p class="hinweis" style="margin-top:0">Eine Zeile pro Stichwort: <span class="code">Wort: Gewicht</span> (1–5). Treffer gelten auch für längere Wörter, die so anfangen. Mit <span class="code">*</span> vorne trifft das Wort überall, z. B. <span class="code">*schule: 3</span>.</p>
      ${th.themenfelder.map((t) => `
        <div class="feld"><label for="tf-${esc(t.id)}">${esc(t.lang || t.name)}</label>
          <textarea id="tf-${esc(t.id)}" data-tf="${esc(t.id)}" rows="6" class="code">${esc(alsZeilen(t.stichwoerter))}</textarea></div>`).join('')}
      <div class="feld"><label for="th-boost">Boost (Grünen-Bezug: Personen, Ressorts …)</label><textarea id="th-boost" rows="5" class="code">${esc(alsZeilen(th.boost))}</textarea></div>
      <div class="feld"><label for="th-aus">Ausschlusswörter (eine Zeile je Wort)</label><textarea id="th-aus" rows="4" class="code">${esc((th.ausschluss || []).join('\n'))}</textarea></div>
      <div class="feld-reihe">
        <div class="feld"><label for="th-hoch">„Hoch“ ab Score</label><input type="number" id="th-hoch" min="1" max="100" value="${esc(th.schwellen?.hoch ?? 55)}"></div>
        <div class="feld"><label for="th-mittel">„Mittel“ ab Score</label><input type="number" id="th-mittel" min="0" max="100" value="${esc(th.schwellen?.mittel ?? 25)}"></div>
      </div>
      <p class="hinweis" style="margin-top:0">${S.ausgeschlossen || 0} Meldungen sind derzeit durch Ausschlusswörter ausgeblendet.</p>
      <div class="btn-reihe">
        <button class="btn primaer" type="submit" style="margin-left:0">Speichern & neu bewerten</button>
        <button class="btn" type="button" data-act="themen-reset">Auf Standard zurücksetzen</button>
      </div>
    </form>
  </details>

  <details class="panel">
    <summary>Textvorlagen ${eigeneVorlagen ? '<span class="status">angepasst</span>' : ''}</summary>
    <form id="vorlagen-form">
      <p class="hinweis" style="margin-top:0">Platzhalter: <span class="code">{titel} {quelle} {link} {datum} {teaser} {themenfeld} {treffer} {hashtags} {name} {fachprofil} {rolle} {gremium}</span></p>
      ${(vo.vorlagen || []).map((v) => `
        <div class="feld"><label for="v-${esc(v.id)}">${esc(v.name)}</label>
          <textarea id="v-${esc(v.id)}" data-vorlage-text="${esc(v.id)}" rows="7">${esc(v.text)}</textarea></div>`).join('')}
      <div class="feld"><label for="v-claude">Prompt für Claude</label><textarea id="v-claude" rows="9">${esc(vo.claudePrompt || '')}</textarea></div>
      <div class="btn-reihe">
        <button class="btn primaer" type="submit" style="margin-left:0">Vorlagen speichern</button>
        <button class="btn" type="button" data-act="vorlagen-reset">Auf Standard zurücksetzen</button>
      </div>
    </form>
  </details>

  <details class="panel">
    <summary>Sichern: Export & Import</summary>
    <p class="hinweis" style="margin-top:0">Exportiert Profil, Stichwörter, Vorlagen, Gemerktes, Gelesenes, Entwürfe und dein Engagement-Log als JSON-Datei.</p>
    <div class="btn-reihe">
      <button class="btn primaer" type="button" data-act="export" style="margin-left:0">Exportieren</button>
      <label class="btn" for="import-datei">Importieren …</label>
      <input type="file" id="import-datei" accept="application/json,.json" hidden>
      <button class="btn" type="button" data-act="export-themen">Nur Stichwörter exportieren</button>
    </div>
    <div class="btn-reihe"><button class="btn gefahr" type="button" data-act="alles-loeschen">Alle lokalen Daten löschen</button></div>
  </details>

  <details class="panel">
    <summary>Quellen-Status</summary>
    <p class="hinweis" style="margin-top:0">Letzte Aktualisierung: ${stand ? esc(`${datumLang(stand)}, ${uhrzeit(stand)} Uhr`) : 'unbekannt'}. Die Quellen werden in <span class="code">config/feeds.json</span> gepflegt.</p>
    <ul class="liste">${(S.news.quellen || []).map((q) => `<li><div class="zeile-zwischen"><span class="titel">${esc(q.name)}</span><span class="${q.ok ? 'tag tf-umwelt' : 'status'}">${q.ok ? `${q.anzahl} Meldungen` : 'Fehler'}</span></div>${q.fehler ? `<div class="unter">${esc(q.fehler)}</div>` : ''}</li>`).join('')}</ul>
  </details>
  <p class="hinweis" style="text-align:center;margin-top:20px">Grünes Bremen – Lage & Mitmachen · privates Projekt, keine offizielle Seite der Partei</p>`;
}

// ============ Router ============
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [seite, id] = h.split('/');
  return { seite: seite || '', id: id ? decodeURIComponent(id) : '' };
}

let letzteSeite = null;
function render({ scroll = true } = {}) {
  const { seite, id } = route();
  const app = $('#app');
  let html;
  if (seite === 'm') html = ansichtDetail(id);
  else if (seite === 'gemerkt') html = ansichtGemerkt();
  else if (seite === 'themen') html = ansichtThemen();
  else if (seite === 'engagement') html = ansichtEngagement();
  else if (seite === 'einstellungen') html = ansichtEinstellungen();
  else html = ansichtLage();
  app.innerHTML = html;
  for (const a of $$('.tabbar a')) {
    const aktiv = a.dataset.route === (seite === 'm' ? '' : seite);
    if (aktiv) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const schluessel = seite + '/' + id;
  if (scroll && schluessel !== letzteSeite) window.scrollTo(0, 0);
  letzteSeite = schluessel;
  zeigeStand();
}

function zeigeStand() {
  const s = S.news.stand;
  $('#stand').textContent = s ? `Stand ${relativ(s)}` : '';
}

// ============ Aktionen ============
function istGemerktCluster(c) {
  const g = gemerkt();
  return c.alle.some((m) => g[m.id]);
}

function merkeUmschalten(id) {
  const g = gemerkt();
  const c0 = S.nachId.get(id);
  const vorhanden = c0 ? c0.alle.filter((m) => g[m.id]) : g[id] ? [{ id }] : [];
  if (vorhanden.length) for (const m of vorhanden) delete g[m.id];
  else {
    const c = S.nachId.get(id);
    const m = c?.haupt;
    if (!m) return;
    g[c.id] = { titel: m.titel, quelle: c.quellen.join(', '), link: m.link, datum: m.datum, themenfeld: c.themenfeld, gemerktAm: new Date().toISOString() };
    toast('Gemerkt');
  }
  store.set('gemerkt', g);
}

function gelesenSetzen(id, wert) {
  const c = S.nachId.get(id);
  const ids = c ? c.alle.map((m) => m.id) : [id];
  const g = gelesen();
  for (const x of ids) wert ? g.add(x) : g.delete(x);
  // nur IDs behalten, die es noch gibt (Speicher schonen)
  store.set('gelesen', [...g].filter((x) => S.nachId.has(x)));
}

function icsFuer(t) {
  const fmt = (iso) => {
    if (/Z$/.test(iso)) return ':' + iso.replace(/[-:]/g, '').replace(/\.\d+/, '');
    return ';TZID=Europe/Berlin:' + iso.replace(/[-:]/g, '').slice(0, 15);
  };
  let ende = t.ende;
  if (!ende) {
    const d = new Date(t.start);
    d.setHours(d.getHours() + 2);
    ende = /Z$/.test(t.start) ? d.toISOString() : `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}:00`;
  }
  const e = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const uid = `${(t.start + t.titel).replace(/[^a-z0-9]/gi, '').slice(0, 40)}@gruenes-bremen`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gruenes Bremen//Lage und Mitmachen//DE', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART${fmt(t.start)}`, `DTEND${fmt(ende)}`,
    `SUMMARY:${e(t.titel)}`, t.ort ? `LOCATION:${e(t.ort)}` : '', t.link ? `URL:${t.link}` : '', t.link ? `DESCRIPTION:${e(t.link)}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n';
}

function exportDaten(nurThemen = false) {
  const daten = nurThemen
    ? themen()
    : {
        app: 'gruenes-bremen', version: 1, exportiert: new Date().toISOString(),
        profil: store.get('profil', null), themen: store.get('themen', null), vorlagen: store.get('vorlagen', null),
        gemerkt: gemerkt(), gelesen: store.get('gelesen', []), entwuerfe: store.get('entwuerfe', {}), log: logbuch(), darstellung: store.get('darstellung', 'system'),
      };
  herunterladen(nurThemen ? 'themen.json' : `gruenes-bremen-backup-${heuteISO()}.json`, JSON.stringify(daten, null, 2), 'application/json');
}

async function importDaten(datei) {
  try {
    const d = JSON.parse(await datei.text());
    if (Array.isArray(d.themenfelder)) {
      store.set('themen', d); // reine themen.json
    } else if (d.app === 'gruenes-bremen') {
      for (const k of ['profil', 'themen', 'vorlagen', 'gemerkt', 'gelesen', 'entwuerfe', 'log', 'darstellung']) {
        if (d[k] == null) store.del(k); else store.set(k, d[k]);
      }
    } else throw new Error('Unbekanntes Format');
    wendeDarstellungAn();
    neuBewerten();
    render();
    toast('Import erfolgreich');
  } catch (e) {
    toast('Import fehlgeschlagen: ' + e.message);
  }
}

function wendeDarstellungAn() {
  const d = store.get('darstellung', 'system');
  if (d === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', d);
}

function aktuellerCluster(el) {
  const id = el.closest('[data-id]')?.dataset.id || route().id;
  return S.nachId.get(id);
}

document.addEventListener('click', (ev) => {
  const ziel = ev.target.closest('[data-act], [data-sort], [data-tab], [data-vorlage], [data-f-themenfeld], [data-f-zeitraum], [data-f-relevanz], [data-f-sort], [data-f-quelle], [data-f-stichwort], [data-f-entfernen], [data-f-nur-stichwort], [data-f-nur-themenfeld]');
  if (!ziel) return;
  const act = ziel.dataset.act;
  const d = ziel.dataset;
  const filterGeaendert = () => { speichereFilter(); render({ scroll: false }); sheetZeichnen(); };

  // --- Filter ---
  if ('fThemenfeld' in d) { filter.themenfeld = filter.themenfeld === d.fThemenfeld && ziel.classList.contains('ressort') ? '' : d.fThemenfeld; if (route().seite) location.hash = '#/'; filterGeaendert(); return; }
  if ('fZeitraum' in d) { filter.zeitraum = d.fZeitraum; filterGeaendert(); return; }
  if ('fRelevanz' in d) { filter.relevanz = d.fRelevanz; filterGeaendert(); return; }
  if ('fSort' in d) { filter.sortierung = d.fSort; filterGeaendert(); return; }
  if ('fQuelle' in d) { filter.quelle = d.fQuelle; filterGeaendert(); return; }
  if ('fStichwort' in d) {
    const w = d.fStichwort;
    filter.stichwoerter = filter.stichwoerter.includes(w) ? filter.stichwoerter.filter((x) => x !== w) : [...filter.stichwoerter, w];
    filterGeaendert(); return;
  }
  if ('fEntfernen' in d) {
    const k = d.fEntfernen;
    if (k === 'zeitraum') filter.zeitraum = '7';
    else if (k === 'relevanz') filter.relevanz = '';
    else if (k === 'quelle') filter.quelle = '';
    else if (k === 'gelesen') filter.ohneGelesene = false;
    else if (k.startsWith('stichwort:')) filter.stichwoerter = filter.stichwoerter.filter((x) => x !== k.slice(10));
    filterGeaendert(); return;
  }
  if ('fNurStichwort' in d || 'fNurThemenfeld' in d) {
    Object.assign(filter, { ...STANDARD_FILTER, sortierung: filter.sortierung, stichwoerter: [] });
    if ('fNurStichwort' in d) filter.stichwoerter = [d.fNurStichwort];
    else filter.themenfeld = d.fNurThemenfeld;
    speichereFilter();
    location.hash = '#/';
    return;
  }
  if ('sort' in d) { filter.sortierung = filter.sortierung === 'neueste' ? 'relevanz' : 'neueste'; filterGeaendert(); return; }
  if (act === 'sheet-auf') { sheetAuf(); return; }
  if (act === 'sheet-zu') { sheetZu(); return; }
  if (act === 'filter-reset') { Object.assign(filter, { ...STANDARD_FILTER, stichwoerter: [] }); filterGeaendert(); return; }
  if (ziel.dataset.tab) { S.detailTab = ziel.dataset.tab; render({ scroll: false }); return; }
  if (ziel.dataset.vorlage) { S.vorlageId = ziel.dataset.vorlage; render({ scroll: false }); return; }

  const c = aktuellerCluster(ziel);
  switch (act) {
    case 'oeffnen':
      if (c) { gelesenSetzen(c.id, true); setTimeout(() => render({ scroll: false }), 300); }
      break;
    case 'merken': {
      ev.preventDefault();
      const id = ziel.dataset.id || ziel.closest('[data-id]')?.dataset.id;
      if (id) merkeUmschalten(id);
      render({ scroll: false });
      break;
    }
    case 'gelesen':
      if (c) { gelesenSetzen(c.id, ziel.getAttribute('aria-pressed') !== 'true'); render({ scroll: false }); }
      break;
    case 'zurueck':
      if (history.length > 1) { ev.preventDefault(); history.back(); }
      break;
    case 'kopieren':
      kopieren($('#entwurf').value);
      break;
    case 'prompt':
      if (c) kopieren(fuelle(vorlagen().claudePrompt, platzhalter(c)));
      break;
    case 'vorlage-neu': {
      const e = store.get('entwuerfe', {});
      delete e[$('#entwurf').dataset.schluessel];
      store.set('entwuerfe', e);
      render({ scroll: false });
      break;
    }
    case 'ics': {
      const t = S.termine[Number(ziel.dataset.termin)];
      if (t) herunterladen(`${t.titel.replace(/[^\wäöüÄÖÜß-]+/g, '_')}_${t.start.slice(0, 10)}.ics`, icsFuer(t), 'text/calendar');
      break;
    }
    case 'log-loeschen':
      if (confirm('Eintrag löschen?')) { store.set('log', logbuch().filter((e) => e.id !== ziel.dataset.log)); render({ scroll: false }); }
      break;
    case 'themen-reset':
      if (confirm('Stichwörter auf den Standard aus config/themen.json zurücksetzen?')) { store.del('themen'); neuBewerten(); render({ scroll: false }); toast('Zurückgesetzt'); }
      break;
    case 'vorlagen-reset':
      if (confirm('Vorlagen auf den Standard zurücksetzen?')) { store.del('vorlagen'); render({ scroll: false }); toast('Zurückgesetzt'); }
      break;
    case 'export': exportDaten(); break;
    case 'export-themen': exportDaten(true); break;
    case 'alles-loeschen':
      if (confirm('Wirklich ALLE lokalen Daten (Profil, Gemerktes, Log …) löschen? Vorher exportieren!')) {
        for (const k of ['profil', 'themen', 'vorlagen', 'gemerkt', 'gelesen', 'entwuerfe', 'log', 'filter', 'darstellung']) store.del(k);
        wendeDarstellungAn(); neuBewerten(); render(); toast('Gelöscht');
      }
      break;
  }
});

function speichereFilter() {
  const { suche, ...rest } = filter;
  store.set('filter', rest);
}

let sucheTimer;
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'f-suche') {
    filter.suche = t.value;
    clearTimeout(sucheTimer);
    sucheTimer = setTimeout(() => {
      const pos = t.selectionStart;
      render({ scroll: false });
      const neu = $('#f-suche');
      if (neu) { neu.focus(); try { neu.setSelectionRange(pos, pos); } catch { /* egal */ } }
    }, 250);
  } else if (t.id === 'entwurf') {
    const e = store.get('entwuerfe', {});
    e[t.dataset.schluessel] = t.value;
    // höchstens 60 Entwürfe behalten
    const keys = Object.keys(e);
    if (keys.length > 60) delete e[keys[0]];
    store.set('entwuerfe', e);
  }
});

document.addEventListener('change', (ev) => {
  const t = ev.target;
  const map = { 'f-themenfeld': 'themenfeld', 'f-relevanz': 'relevanz', 'f-quelle': 'quelle' };
  if (map[t.id]) { filter[map[t.id]] = t.value; speichereFilter(); render({ scroll: false }); }
  else if (t.id === 'f-gelesen') { filter.ohneGelesene = t.checked; speichereFilter(); render({ scroll: false }); sheetZeichnen(); }
  else if (t.id === 'import-datei' && t.files[0]) importDaten(t.files[0]);
});

document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (f.id === 'profil-form') {
    store.set('profil', { name: $('#p-name').value.trim(), fachprofil: $('#p-fach').value.trim(), rolle: $('#p-rolle').value.trim() });
    store.set('darstellung', $('#p-theme').value);
    wendeDarstellungAn();
    toast('Profil gespeichert');
  } else if (f.id === 'themen-form') {
    const neu = structuredClone(themen());
    for (const ta of $$('[data-tf]', f)) {
      const tf = neu.themenfelder.find((t) => t.id === ta.dataset.tf);
      if (tf) tf.stichwoerter = ausZeilen(ta.value);
    }
    neu.boost = ausZeilen($('#th-boost').value);
    neu.ausschluss = $('#th-aus').value.split('\n').map((s) => s.trim()).filter(Boolean);
    neu.schwellen = { hoch: Number($('#th-hoch').value) || 55, mittel: Number($('#th-mittel').value) || 25 };
    store.set('themen', neu);
    neuBewerten();
    render({ scroll: false });
    toast('Gespeichert – alle Meldungen neu bewertet');
  } else if (f.id === 'vorlagen-form') {
    const neu = structuredClone(vorlagen());
    for (const ta of $$('[data-vorlage-text]', f)) {
      const v = neu.vorlagen.find((x) => x.id === ta.dataset.vorlageText);
      if (v) v.text = ta.value;
    }
    neu.claudePrompt = $('#v-claude').value;
    store.set('vorlagen', neu);
    toast('Vorlagen gespeichert');
  } else if (f.id === 'log-form') {
    const c = f.dataset.meldung ? S.nachId.get(f.dataset.meldung) : null;
    const eintrag = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      datum: $('#log-datum', f).value || heuteISO(),
      typ: $('#log-typ', f).value,
      notiz: $('#log-notiz', f).value.trim(),
      meldungId: c?.id || '',
      meldungTitel: c?.haupt.titel || '',
      link: c?.haupt.link || '',
    };
    store.set('log', [...logbuch(), eintrag]);
    toast('Im Engagement-Log gespeichert');
    render({ scroll: false });
  }
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') sheetZu(); });

window.addEventListener('hashchange', () => {
  sheetZu();
  if (route().seite === 'm') { S.detailTab = 'beitrag'; S.vorlageId = null; }
  render();
});

function onlineStatus() { $('#offline').hidden = navigator.onLine; }
window.addEventListener('online', onlineStatus);
window.addEventListener('offline', onlineStatus);

$('#neu-laden').addEventListener('click', async () => {
  const b = $('#neu-laden');
  b.classList.add('dreht');
  await ladeAlles();
  render({ scroll: false });
  b.classList.remove('dreht');
  toast(navigator.onLine ? 'Daten aktualisiert' : 'Offline – zeige gespeicherte Daten');
});

// ============ Start ============
wendeDarstellungAn();
onlineStatus();
ladeAlles().then(() => render());
setInterval(zeigeStand, 60e3);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* z. B. file:// */ });
  });
}
