// Regelbasierte Relevanz-Bewertung + Themen-Zusammenfassung.
// Wird von der App (Browser) UND vom Fetch-Skript (Node) benutzt.

const BUCHSTABE = 'a-z0-9äöüß';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Baut aus einem Stichwort einen Suchausdruck.
// "Kita"     -> trifft Wörter, die mit "kita" anfangen (Kita, Kitas, Kitaplätze)
// "*schule"  -> trifft "schule" irgendwo im Wort (Grundschule, Oberschulen)
export function stichwortRegex(wort) {
  const w = String(wort).trim().toLowerCase();
  if (!w) return null;
  if (w.startsWith('*')) return new RegExp(escapeRegex(w.slice(1)), 'u');
  return new RegExp(`(^|[^${BUCHSTABE}])${escapeRegex(w)}`, 'u');
}

// Vorbereitete (kompilierte) Regeln aus themen.json
export function kompiliereRegeln(themen) {
  const liste = (obj) =>
    Object.entries(obj || {})
      .map(([wort, gewicht]) => ({ wort, gewicht: Number(gewicht) || 1, re: stichwortRegex(wort) }))
      .filter((x) => x.re);
  return {
    themenfelder: (themen.themenfelder || []).map((tf) => ({ id: tf.id, name: tf.name, lang: tf.lang || tf.name, regeln: liste(tf.stichwoerter) })),
    boost: liste(themen.boost),
    ausschluss: (themen.ausschluss || []).map((w) => ({ wort: w, re: stichwortRegex(w) })).filter((x) => x.re),
    hoch: themen.schwellen?.hoch ?? 55,
    mittel: themen.schwellen?.mittel ?? 25,
    politikfeld: themen.politikbezug?.themenfeld ?? 'politik',
    ohnePolitikFaktor: themen.politikbezug?.faktorOhne ?? 0.75,
  };
}

const gross = (w) => w.charAt(0).toUpperCase() + w.slice(1);

function trefferIn(regeln, titel, text) {
  const t = [];
  for (const r of regeln) {
    const imTitel = r.re.test(titel);
    if (imTitel || r.re.test(text)) t.push({ wort: gross(r.wort.replace(/^\*/, '')), punkte: r.gewicht * (imTitel ? 1.5 : 1) });
  }
  // Überlappende Stichwörter nur einmal zählen: "Jugend" + "Jugendliche" -> nur "Jugendliche" (höchstes Gewicht)
  return t
    .map((x) => {
      const laengere = t.filter((y) => y !== x && y.wort.toLowerCase().includes(x.wort.toLowerCase()));
      if (laengere.length) return null;
      const kuerzere = t.filter((y) => y !== x && x.wort.toLowerCase().includes(y.wort.toLowerCase()));
      return { ...x, punkte: Math.max(x.punkte, ...kuerzere.map((y) => y.punkte)) };
    })
    .filter(Boolean);
}

// Bewertet eine einzelne Meldung. bonus = Extrapunkte der Quelle (z. B. Grünen-Quellen).
export function bewerte(meldung, regeln, bonus = 0) {
  const titel = (meldung.titel || '').toLowerCase();
  const text = titel + ' ' + (meldung.teaser || '').toLowerCase();

  const ausgeschlossen = regeln.ausschluss.find((a) => a.re.test(text));
  if (ausgeschlossen) {
    return { themenfeld: 'sonstiges', score: 0, label: 'Niedrig', begruendung: `Ausschlusswort: ${ausgeschlossen.wort}`, treffer: [], ausgeschlossen: true };
  }

  const felder = regeln.themenfelder.map((tf) => {
    const tr = trefferIn(tf.regeln, titel, text);
    return { id: tf.id, name: tf.name, treffer: tr, summe: tr.reduce((s, x) => s + x.punkte, 0) };
  });
  felder.sort((a, b) => b.summe - a.summe);
  const bestes = felder[0] && felder[0].summe > 0 ? felder[0] : null;
  const nebenSumme = felder.slice(1).reduce((s, f) => s + f.summe, 0);

  const boost = trefferIn(regeln.boost, titel, text);
  const boostSumme = boost.reduce((s, x) => s + x.punkte, 0);

  let roh = (bestes ? bestes.summe : 0) + 0.4 * nebenSumme + boostSumme + (Number(bonus) || 0);
  // Ohne jeden politischen oder Grünen-Bezug etwas abwerten (z. B. reine Alltagsgeschichten)
  const politik = felder.find((f) => f.id === regeln.politikfeld);
  const ohnePolitik = (!politik || politik.summe === 0) && boostSumme === 0 && !(bonus > 0);
  if (ohnePolitik) roh *= regeln.ohnePolitikFaktor;
  const score = Math.round(100 * (1 - Math.exp(-roh / 7)));

  // Treffer sortiert nach Punkten, ohne Dubletten
  const alle = [...(bestes ? bestes.treffer : []), ...felder.slice(1).flatMap((f) => f.treffer)];
  const woerter = ohneTeilwoerter(alle.sort((a, b) => b.punkte - a.punkte).map((x) => x.wort));
  const boostWoerter = ohneTeilwoerter(boost.map((b) => b.wort));

  const teile = [];
  teile.push(bestes ? `Themenfeld ${bestes.name}` : 'Kein Themenfeld');
  if (woerter.length) teile.push('Treffer: ' + woerter.slice(0, 4).join(', '));
  if (boostWoerter.length) teile.push('Grünen-Bezug' + (boostWoerter.some((w) => !/^gr(ü|u)ne|bündnis/i.test(w)) ? ': ' + boostWoerter.filter((w) => !/^gr(ü|u)ne|bündnis/i.test(w)).slice(0, 2).join(', ') : ''));
  else if (bonus > 0) teile.push('Grünen-Quelle');
  if (ohnePolitik && bestes && bestes.id !== regeln.politikfeld) teile.push('ohne Politikbezug');

  return {
    themenfeld: bestes ? bestes.id : 'sonstiges',
    score,
    label: labelFuer(score, regeln),
    begruendung: teile.join(' · '),
    treffer: [...woerter, ...boostWoerter],
    ausgeschlossen: false,
  };
}

// "klima" fällt weg, wenn "Klimaschutz" schon da ist; "Fecker" weg, wenn "Björn Fecker" da ist
function ohneTeilwoerter(liste) {
  const eindeutig = [...new Map(liste.map((w) => [w.toLowerCase(), w])).values()];
  return eindeutig.filter((w) => !eindeutig.some((x) => x !== w && x.toLowerCase().includes(w.toLowerCase())));
}

export function labelFuer(score, regeln) {
  if (score >= regeln.hoch) return 'Hoch';
  if (score >= regeln.mittel) return 'Mittel';
  return 'Niedrig';
}

// ---------- Ähnliche Titel zusammenfassen ----------
const STOPP = new Set('der die das und oder in im am an auf aus bei mit nach von vor zu zum zur für über unter um ist sind wird werden wurde soll sollen hat haben ein eine einen einem einer eines nicht auch noch nur wie was wer als bis dass des den dem sich es sie er wir ihr so mehr neue neuer neues jetzt heute bremen bremer bremens bremerhaven'.split(' '));

export function titelTokens(titel) {
  return new Set(
    (titel || '')
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOPP.has(w))
      .map((w) => w.slice(0, 7)) // grober "Wortstamm"
  );
}

function aehnlich(a, b, minGemeinsam = 2) {
  let gemeinsam = 0;
  for (const t of a) if (b.has(t)) gemeinsam++;
  const vereinigt = a.size + b.size - gemeinsam;
  return gemeinsam >= minGemeinsam && vereinigt > 0 ? gemeinsam / vereinigt : 0;
}

const normTitel = (t) => (t || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

// Gruppiert Meldungen zum selben Thema: ähnlicher Titel (oder Titel+Teaser) aus verschiedenen Quellen,
// max. 2 Tage auseinander. Gleiche Titel derselben Quelle (z. B. Artikel + Audio) werden ebenfalls zusammengefasst.
// Rückgabe: Liste von Clustern { haupt, weitere: [...], quellen: Set, score }
export function clustere(meldungen, schwelle = 0.4) {
  const sortiert = [...meldungen].sort((a, b) => b.score - a.score || new Date(b.datum) - new Date(a.datum));
  const cluster = [];
  for (const m of sortiert) {
    const tok = titelTokens(m.titel);
    const tokLang = titelTokens(m.titel + ' ' + (m.teaser || ''));
    const nt = normTitel(m.titel);
    const zeit = new Date(m.datum).getTime();
    let ziel = null;
    for (const c of cluster) {
      if (Math.abs(c.zeit - zeit) > 2 * 864e5) continue;
      if (c.titel.has(nt)) { ziel = c; break; }
      if (c.quellen.has(m.quelle)) continue;
      // Schwellen an echten Bremer Meldungen kalibriert (Nov. 2026)
      const t = aehnlich(tok, c.tokens);
      const l = aehnlich(tokLang, c.tokensLang, 6);
      const l2 = aehnlich(tokLang, c.tokensLang, 4);
      if (t >= schwelle || l >= 0.17 || (t >= 0.2 && l2 >= 0.12)) { ziel = c; break; }
    }
    if (ziel) {
      ziel.weitere.push(m);
      ziel.quellen.add(m.quelle);
      ziel.titel.add(nt);
    } else {
      cluster.push({ haupt: m, weitere: [], quellen: new Set([m.quelle]), titel: new Set([nt]), tokens: tok, tokensLang: tokLang, zeit });
    }
  }
  // Mehrere Quellen = großes Thema -> kleiner Bonus
  for (const c of cluster) {
    const extra = c.quellen.size - 1;
    c.score = Math.min(100, c.haupt.score + extra * 5);
    c.id = c.haupt.id;
  }
  return cluster;
}
