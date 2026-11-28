# Grünes Bremen – Lage & Mitmachen

Persönliche Nachrichten-App (PWA) für Bremer Themen. Sie zeigt mir zweimal täglich die aktuellen Meldungen, bewertet ihre Relevanz für die Bremer Grünen nach festen Regeln und hilft mir beim Mitmachen: Beitragsentwürfe, passende Gremien und Termine, Ansprechpartner*innen und mein Engagement-Log.

- **Keine KI-API, keine laufenden Kosten.** Die Relevanz entsteht aus Stichwörtern und Gewichtungen.
- **Kein Backend.** GitHub Actions holt die Feeds, GitHub Pages liefert die App aus.
- **Private Daten bleiben auf dem iPhone.** Profil, Gemerktes, Entwürfe und Log liegen nur im Browser (localStorage) und lassen sich als JSON exportieren.
- Privates Projekt, keine offizielle Seite der Partei. Es gibt kein Parteilogo und kein Corporate Design.

## Inhalt
1. [So funktioniert's](#1-so-funktionierts)
2. [Einrichten: Schritt für Schritt](#2-einrichten-schritt-für-schritt)
3. [Auf dem iPhone installieren](#3-auf-dem-iphone-installieren)
4. [Stichwörter pflegen](#4-stichwörter-pflegen)
5. [Gremien, Termine & Kontakte pflegen](#5-gremien-termine--kontakte-pflegen)
6. [Quellen (Feeds) pflegen](#6-quellen-feeds-pflegen)
7. [Lokal testen](#7-lokal-testen)
8. [Dateien & Datenformate](#8-dateien--datenformate)
9. [Probleme lösen](#9-probleme-lösen)

---

## 1. So funktioniert's

```
 06:00 + 17:00 Uhr
 GitHub Action ──► scripts/fetch-news.mjs ──► lädt Feeds (config/feeds.json)
                                         ──► bewertet (config/themen.json)
                                         ──► schreibt data/news.json + data/termine-auto.json
                                         ──► commit ins Repo
 GitHub Pages ──► liefert index.html + JSON-Dateien aus
 iPhone-App   ──► lädt die JSON-Dateien, speichert sie offline (Service Worker)
              ──► bewertet mit DEINEN Stichwörtern neu (falls in der App geändert)
```

**Relevanz-Score (0–100):**
- Jedes Stichwort hat ein Gewicht von 1 bis 3. Ein Treffer im Titel zählt 1,5-fach.
- Das Themenfeld mit den meisten Punkten bestimmt die Einordnung. Andere Felder zählen zu 40 % mit.
- Hinzu kommen Boost-Wörter (Grünen-Bezug: Personen, Ressorts) und ein Quellen-Bonus (Grünen-Quellen +3, Bürgerschaft +1).
- Meldungen ganz ohne Politik- oder Grünen-Bezug werden mit dem Faktor 0,75 abgeschwächt.
- Daraus wird eine Kurve: `Score = 100 × (1 − e^(−Punkte/7))`.
  - **Hoch** ab 55
  - **Mittel** ab 25
  - **Niedrig** darunter
- Bei Ausschlusswörtern wie „Bundesliga“ wird die Meldung ausgeblendet.
- Ähnliche Titel aus verschiedenen Quellen werden zu einem Thema zusammengefasst („3 Quellen“, +5 Punkte je weitere Quelle).
- Die Begründung baut sich aus den Treffern zusammen, z. B. „Themenfeld Umwelt & Klima · Treffer: Starkregen, Senat · Grünen-Bezug“.

**Quellen (geprüft am 27.11.2026):**

| Quelle | Weg | Status |
|---|---|---|
| buten un binnen | RSS „Aktuelle Nachrichten“ | ✅ |
| Weser-Kurier Bremen, Politik, Stadtteile | RSS (`?view=rss`) | ✅ (Teaser teils kurz, wegen Paywall) |
| taz Bremen | RSS | ✅ |
| Grüne Landesverband Bremen | RSS (WordPress) | ✅ |
| Grüne Bürgerschaftsfraktion | kein RSS, die Pressemitteilungs-Liste wird ausgelesen | ✅ |
| Bremische Bürgerschaft | kein RSS, Ersatz: offizielles Mastodon-Konto | ✅ |
| Senatspressestelle | Server sperrt automatische Abrufe (403) | ❌ deaktiviert |
| Termine Grüne Bremen | Kalender-Export `.ics` von gruene-bremen.de/termine | ✅ automatisch |

---

## 2. Einrichten: Schritt für Schritt

> Du brauchst nur einen Browser und deinen GitHub-Account.

### 2.1 Repository anlegen (schon erledigt)
1. Gehe auf [github.com/new](https://github.com/new).
2. Name: `gruenes-bremen`.
3. „Create repository“.

> **Public oder Private?** GitHub Pages funktioniert bei privaten Repos nur mit einem bezahlten Plan (GitHub Pro). Im Repo liegen keine privaten Daten: Dein Profil, Log und Gemerktes bleiben auf dem iPhone. Die Kontaktangaben stammen von öffentlichen Webseiten. Mit *Public* kostet alles nichts.
> Umstellen: Repo → **Settings** → ganz unten „Danger Zone“ → **Change visibility** → **Public**.

### 2.2 Code nach `main` übernehmen
Der Code wurde auf einem eigenen Branch entwickelt (`claude/gruenes-bremen-news-pwa-…`). So übernimmst du ihn:
1. Repo → **Pull requests** → **New pull request**.
2. base: `main`, compare: den `claude/…`-Branch.
3. **Create pull request** → **Merge pull request** → **Confirm merge**.

### 2.3 Der Action Schreibrechte geben
1. Repo → **Settings** → **Actions** → **General**.
2. Ganz unten bei „Workflow permissions“: **Read and write permissions** wählen.
3. **Save**.

### 2.4 GitHub Pages aktivieren
1. Repo → **Settings** → **Pages**.
2. „Source“: **Deploy from a branch**.
3. Branch: **main**, Ordner: **/ (root)** → **Save**.
4. Nach 1–2 Minuten steht oben die Adresse, etwa `https://<dein-github-name>.github.io/gruenes-bremen/`.

### 2.5 Die Action zum ersten Mal starten
1. Repo → **Actions**. Falls ein Hinweis kommt, die Workflows aktivieren.
2. Links **„Nachrichten aktualisieren“** → rechts **Run workflow** → **Run workflow**.
3. Nach ca. 1 Minute erscheint ein grüner Haken ✅. Im Repo gibt es dann einen neuen Commit „Nachrichten aktualisiert: …“.
4. Ab jetzt läuft die Action automatisch um **6:00 und 17:00 Uhr** (Sommer- und Winterzeit werden berücksichtigt).

> Geplante Actions starten bei GitHub manchmal 5–30 Minuten später.

---

## 3. Auf dem iPhone installieren
1. Öffne die Pages-Adresse in **Safari**.
2. Tippe auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm**.
3. Die App startet jetzt wie eine normale App. Sie funktioniert auch **offline** mit den zuletzt geladenen Meldungen.
4. Einmal einrichten: **Einstellungen** (unten rechts) → **Mein Profil** → Name, Fachprofil und Rolle eintragen → Speichern.
5. **Filtern:** Oben auf der Lage-Seite die Ressorts (Landespolitik, Umwelt & Klima …) antippen. Über **Filter** wählst du Zeitraum, Relevanz, Quelle und beliebig viele **Stichwörter**. Auf der Seite **Themen** führt ein Tippen auf ein Stichwort oder Themenfeld direkt zur gefilterten Lage.
6. Ab und zu sichern: **Einstellungen → Sichern → Exportieren**. Die JSON-Datei z. B. in iCloud Drive ablegen.

> iOS kann Website-Daten von Apps löschen, die mehrere Wochen nicht geöffnet wurden. Deshalb ist der Export wichtig.

---

## 4. Stichwörter pflegen

**Variante A – in der App (nur für dich, sofort wirksam)**
- **Einstellungen → Stichwörter & Gewichtung.** Eine Zeile pro Wort, z. B. `Starkregen: 3`.
- „Speichern & neu bewerten“ bewertet alle Meldungen sofort neu.
- Mit „Nur Stichwörter exportieren“ bekommst du eine fertige `themen.json`.

**Variante B – dauerhaft im Repo (gilt auch für die Action)**
1. Repo → `config/themen.json` → Stift-Symbol (Edit).
2. Ändern, dann „Commit changes“.
3. Hast du vorher in der App Stichwörter geändert, setze sie dort einmal zurück (Einstellungen → „Auf Standard zurücksetzen“). Erst dann gilt die Repo-Version.

**Regeln für Stichwörter:**
| Schreibweise | trifft | Beispiel |
|---|---|---|
| `Kita` | Wörter, die so **anfangen** | Kita, Kitas, Kitaplätze |
| `*schule` | das Wort **irgendwo** im Wort | Grundschule, Oberschulen |
| `Tempo 30` | auch Wortgruppen | |

- Groß- und Kleinschreibung ist egal.
- Überlappende Wörter („Jugend“ und „Jugendliche“) zählen nur einmal.
- **Boost:** Namen von Grünen-Politiker*innen und Ressorts. Den vollen Namen nehmen, wenn der Nachname allein auch andere trifft („Franziska Tell“ statt „Tell“).
- **Ausschluss:** Meldungen mit diesen Wörtern verschwinden.
- **Schwellen:** ab welchem Score „Hoch“ und „Mittel“ gelten.
- **politikbezug.faktorOhne:** auf `1` setzen, wenn Alltagsthemen nicht abgeschwächt werden sollen.

---

## 5. Gremien, Termine & Kontakte pflegen

Alle Dateien liegen in `data/` und lassen sich direkt auf GitHub bearbeiten (Stift-Symbol). Alle vorbefüllten Einträge stammen von den offiziellen Webseiten (Stand 27.11.2026) und tragen `"status": "bitte prüfen"`. Wenn du einen Eintrag geprüft hast, setze den Status auf `""`.

### Gremien – `data/gremien.json`
```json
{
  "id": "lag-umwelt",
  "name": "LAG Umwelt",
  "typ": "LAG",
  "themenfelder": ["umwelt"],
  "stichwoerter": ["Naturschutz", "Gewässer"],
  "beschreibung": "…",
  "turnus": "2. Dienstag im Monat",
  "sprecher": ["Name"],
  "kontakt": "funktionsadresse@…",
  "link": "https://…",
  "kalender": ["LAG Umwelt"],
  "quelle_url": "https://…",
  "stand": "2026-11-27",
  "status": "bitte prüfen"
}
```
- `themenfelder`: `politik`, `umwelt` oder `bildung`. Bestimmt, bei welchen Meldungen das Gremium erscheint.
- `stichwoerter`: feinere Zuordnung. Jeder Treffer in der Meldung erhöht die Passung.
- `kalender`: Textbausteine, über die Termine aus dem Grünen-Kalender diesem Gremium zugeordnet werden. Verglichen wird das ganze Wort: `"Ost"` trifft „KMV Bremen-Ost“, aber nicht „Osterholz“.
- Die privaten E-Mail-Adressen der LAG-Sprecher*innen sind **bewusst nicht** übernommen, nur Funktionsadressen. Die anderen Adressen stehen auf der LAG-Seite (Link).

### Termine – automatisch + `data/termine.json`
- **Automatisch:** Die Action lädt den Kalender von gruene-bremen.de nach `data/termine-auto.json`. Diese Datei bitte nicht von Hand ändern.
- **Eigene Termine** (z. B. Beiratssitzungen) trägst du in `data/termine.json` ein:
```json
{
  "termine": [
    {
      "titel": "Beiratssitzung Hemelingen",
      "start": "2026-12-10T19:00:00",
      "ende": "2026-12-10T21:00:00",
      "ort": "Ortsamt Hemelingen",
      "link": "https://…",
      "gremium": "stadtteilgruppen"
    }
  ]
}
```
  `start`/`ende` in deutscher Ortszeit. `gremium` = `id` aus gremien.json (optional).
- In der App lädt der Button **.ics** den Termin in den iPhone-Kalender.

### Kontakte – `data/kontakte.json`
```json
{
  "id": "ralph-saxe",
  "name": "Ralph Saxe",
  "rolle": "…",
  "fachgebiete": ["Umwelt", "Verkehr"],
  "themenfelder": ["umwelt"],
  "stichwoerter": ["Verkehr", "Starkregen"],
  "email": "",
  "telefon": "",
  "profil": "https://…",
  "quelle_url": "https://…",
  "stand": "2026-11-27",
  "status": "bitte prüfen"
}
```
- Bitte **nur öffentliche, offizielle Angaben** eintragen, immer mit `quelle_url` und `stand`.
- Die E-Mail-Adressen der Abgeordneten sind auf der Fraktionsseite verschlüsselt (Spam-Schutz) und deshalb leer. Die App verlinkt stattdessen das Profil.

### Textvorlagen – `config/vorlagen.json` oder in der App
- Platzhalter: `{titel} {quelle} {link} {datum} {teaser} {themenfeld} {treffer} {hashtags} {name} {fachprofil} {rolle} {gremium}`.
- `claudePrompt` ist der Text hinter „Prompt für Claude kopieren“. Den kopierten Text in die Claude-App einfügen.

### Mein Engagement
- Entweder in einer Meldung unter **Mitmachen → Notieren** oder unter **Engagement → Neuen Eintrag hinzufügen**.
- Arten: Post, Leserbrief, Termin besucht, Kontakt aufgenommen, Beitrag intern, Sonstiges.
- Die Übersicht zeigt die Aktionen pro Monat und die letzten 6 Monate als Balken.

---

## 6. Quellen (Feeds) pflegen
`config/feeds.json`:
```json
{
  "id": "taz-bremen",
  "name": "taz Bremen",
  "url": "https://taz.de/Nord/Bremen/!p4652;rss/",
  "typ": "rss",
  "aktiv": true,
  "bonus": 0
}
```
- `typ`:
  - `rss` – RSS oder Atom
  - `mastodon` – Mastodon-Profil + `.rss`
  - `typo3-liste` – Pressemitteilungs-Liste der Grünen-Fraktion
- `aktiv: false` schaltet eine Quelle ab, ohne sie zu löschen.
- `bonus`: Extrapunkte für die Relevanz.
- Die App zeigt unter **Einstellungen → Quellen-Status**, ob jede Quelle beim letzten Lauf funktioniert hat.
- Gespeichert werden nur Titel, Teaser (max. 320 Zeichen), Datum, Quelle und Link. Es werden keine Volltexte gespeichert, Meldungen bleiben 30 Tage.

---

## 7. Lokal testen
Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.
```bash
npm test            # Selbsttest: Parser + Relevanz (ohne Internet)
npm run fetch       # Feeds wirklich laden → data/news.json
npm start           # App unter http://localhost:8080 öffnen
```

---

## 8. Dateien & Datenformate
```
index.html, styles.css            Oberfläche
js/app.js                         App-Logik (Ansichten, Filter, Mitmachen, Log)
js/relevanz.js                    Relevanz-Regeln + Zusammenfassen (App UND Action)
sw.js, manifest.webmanifest       PWA: offline + installierbar
icons/                            App-Icons
config/feeds.json                 Quellen
config/themen.json                Themenfelder, Stichwörter, Boost, Ausschluss
config/vorlagen.json              Textvorlagen + Claude-Prompt
data/news.json                    automatisch: Meldungen
data/termine-auto.json            automatisch: Termine aus dem Grünen-Kalender
data/termine.json                 eigene Termine
data/gremien.json                 LAGs, Kreisverbände, Mitgliederversammlungen …
data/kontakte.json                Ansprechpartner*innen
scripts/fetch-news.mjs            Feed-Lader (ohne npm-Pakete)
scripts/test.mjs                  Selbsttest
.github/workflows/fetch-news.yml  Zeitplan 06:00 + 17:00
```

Ein Eintrag in `data/news.json`:
```json
{
  "id": "028cbc1c4035",
  "titel": "…",
  "teaser": "…",
  "datum": "2026-11-27T20:48:00.000Z",
  "quelle": "buten un binnen",
  "quelleId": "bub",
  "link": "https://…",
  "themenfeld": "umwelt",
  "score": 58,
  "label": "Hoch",
  "begruendung": "Themenfeld Umwelt & Klima · Treffer: …",
  "treffer": ["…"]
}
```

**Nach Änderungen an App-Dateien** (html/css/js) in `sw.js` die Zeile `const VERSION = 'v1'` hochzählen (`'v2'` …). Sonst zeigt das iPhone eventuell noch die alte Version. Bei Änderungen an `data/` und `config/` ist das nicht nötig.

---

## 9. Probleme lösen
| Problem | Lösung |
|---|---|
| Action rot ❌ | Actions → Lauf anklicken → Log lesen. Häufig: Tippfehler in einer JSON-Datei (fehlendes Komma). Prüfen mit [jsonlint.com](https://jsonlint.com). |
| „Permission denied“ beim Push | Schritt 2.3 (Schreibrechte) erledigen. |
| Eine Quelle meldet Fehler | Die Webseite hat ihre Feed-Adresse geändert → in `config/feeds.json` anpassen oder `aktiv: false` setzen. |
| App zeigt alte Version | App schließen und neu öffnen. Notfalls in iOS: Einstellungen → Safari → Erweitert → Website-Daten → github.io löschen (vorher exportieren!). |
| Zu viele / zu wenige „Hoch“ | Schwellen oder Gewichte in den Einstellungen anpassen. |
