# imagony Design v1

Stand 26.09.2026. Abgeleitet aus der navyra-Designgrammatik (gleiche Prinzipien, andere Ausprägung): **Prisma statt Schleife, Fase statt Blatt, Facetten statt Pillen.** Freigegeben von Marc als Richtung; Referenz ist der Prototyp im Design Canvas „imagony Startseite“ und die Demo in `reference/demo-site/`.

## 1. Grundprinzipien

1. **Die Seite ist ohne Animation vollständig.** Jede Bewegung ist Rückmeldung (Button faltet, Seitenwechsel) oder das eine ruhige Motiv (Prisma schwebt). Keine Scroll-Animationen, kein Parallax, keine Hover-Sprünge (`translateY` auf Buttons entfällt).
2. **Ein grosses, angeschnittenes Motiv.** Das Prisma sitzt rechts im Hero, ragt über den Rand und über das Ticker-Band darunter. Es ist dekorativ (`aria-hidden`), nur mit der Maus klickbar.
3. **Fase statt Rundung.** Keine `border-radius` im System. Flächen haben zwei gefaste Ecken, oben rechts und unten links (`clip-path`). Grössen: `--cut-xs` 10px, `--cut-s` 14px (Buttons), `--cut-m` 28px, `--cut-l` 40px (Karten).
4. **Licht kommt aus dem Motiv.** Violet `#6d5ef0` und Cobalt `#3d63f2` sind Leuchtfarben, nie Textfarben. Flächen bleiben dunkel und ruhig.
5. **Eine Hauptschrift, eine Nebenschrift.** Archivo (variabel, breit gesetzt für Thesen) für alles Lesbare, IBM Plex Mono für Etiketten, Nummern, Navigation und Ticker.
6. **Linksbündig, grosse Abstände, genau ein Textakzent.** Auf dunkel ist das Iris `#a99cff`, auf hell Iris-Deep `#5a48d9`. Teal entfällt vollständig.

## 2. Farben und Kontraste

| Token | Wert | Verwendung | Kontrast |
| --- | --- | --- | --- |
| `--void` | #0b0c18 | Seitengrund | |
| `--onyx` | #13152a | Ticker, Hinweisflächen, Grenzsektion | |
| `--slate` | #1d2140 | Karten, Sekundärbutton | |
| `--haze` | #dfe2ee | Überschriften, starker Text | 15.1:1 auf void |
| `--haze-2` | #b9bdd0 | Fliesstext | 10.4:1 auf void, 8.4:1 auf slate |
| `--steel` | #8c93ad | Nebentext, Mono-Etiketten | 6.4:1 auf void, 5.1:1 auf slate |
| `--iris` | #a99cff | einziger Akzent dunkel, Primärbutton | 8.2:1 (void auf iris) |
| `--violet` | #6d5ef0 | nur Licht | kein Text |
| `--cobalt` | #3d63f2 | nur Licht | kein Text |
| `--fog` / `--paper` | #eef0f6 / #fff | helle Sektion / Karten darauf | |
| `--ink` / `--ink-2` | #14172b / #4a4f68 | Text auf hell | 15.5:1 / 7.1:1 auf fog |
| `--iris-deep` | #5a48d9 | Akzent auf hell | 5.5:1 auf fog |

Die alten Variablen (`--bg`, `--panel`, `--text`, `--muted`, `--teal`) bleiben in `tokens.css` als Aliase, damit nichts bricht. Neue Regeln nutzen nur die neuen Namen.

## 3. Typografie

- Schriften selbst hosten (`assets/fonts/`, OFL). Keine Google-Fonts-Anfrage zur Laufzeit (Datenschutz CH/EU).
- Thesen (h1, h2 in Heros und Sektionsköpfen): Archivo 600, `font-stretch: 112%`, `letter-spacing: -0.025em`, `line-height: 1.04`, `text-wrap: balance`.
- Kartentitel: Archivo 600, `font-stretch: 106%`.
- Fliesstext: Archivo 400, `--haze-2`.
- Eyebrow/Kicker, Navigation, Karten-Nummern, Footer-Links, Ticker: IBM Plex Mono 400/500, Versalien, `letter-spacing` 0.06 bis 0.14em.
- `h1 em` / `h2 em` werden nicht mehr eingefärbt (kein Teal-Wort in Thesen).

## 4. Komponenten

| Bisher | Neu | Wo |
| --- | --- | --- |
| `.button.primary` (Teal, rund) | Polygon-Button, Iris-Facetten, Text void | `imagony-motion.css/js` |
| `.button.secondary` | Polygon-Button, Slate-Facetten mit Iris-Kanten | dito |
| `nav .nav-cta` (Rahmen, rund) | kleiner Polygon-Button (8 Facettenspalten) | dito |
| `.brand-mark` „◈“ + `.brand-dot` | SVG-Zeichen `imagony-mark.svg` (offenes Dreieck), Punkt entfällt | `site-restyle.css` |
| `.orb` (Kreis mit Orbits) | Prisma `<div class="prism prism-float hero-prism" data-prism aria-hidden="true"></div>` | Markup + JS |
| `.pulse` | entfällt | |
| `.rule` | Mono-Ticker volle Breite auf onyx, △-Trenner in violet | `site-restyle.css` |
| `.card` (Verlauf, rund) | slate, 1px Lichtkante (`--edge`), Fase `--cut-l`, Nummer als Mono-Chip | dito |
| `.statement`, `.notice`, `.hd-quick-note`, `.hd-boundary` | onyx-Fläche mit Fase, ohne Rahmen | dito |
| `.hero-note` | mit Dreiecks-Hinweiszeichen `imagony-note.svg` | dito |
| `.hd-services` | helle Sektion volle Breite (fog), weisse Karten mit Fase, Akzent iris-deep | dito |
| `.hd-timeline li::before` (Punkt) | kleines Dreieck | dito |
| Formularfelder | eckig, void-Grund, Fokus 2px iris | dito |

Die Facetten werden per JavaScript erzeugt. Ohne JS sehen Buttons flach aus (iris bzw. slate) und bleiben voll bedienbar.

## 5. Bewegung

| Moment | Ablauf | Dauer |
| --- | --- | --- |
| Hover Button | Facetten hellen auf (`brightness(1.1)`), keine Bewegung | 160ms |
| Klick Button, Navigation | Facetten falten von aussen zur Mitte (`scale(.05) rotate(100deg)`), Label blendet aus | 280ms |
| Seitenwechsel, Zudecken | Dreiecksraster (128px) wächst vom Klickpunkt aus über den Bildschirm | ≈ 640ms |
| Seitenwechsel, Entfalten | neue Seite startet verdeckt (`html.fold-pending`), Dreiecke falten vom gleichen Punkt aus weg | ≈ 720ms |
| Klick Button ohne Navigation (Formulare) | Facetten falten und kommen zurück | 560ms |
| Prisma | schwebt 16px / 1.4° | 9s Schleife |
| Klick aufs Prisma | die 14 nächstgelegenen Facetten falten ein und klappen leuchtend zurück | 920ms, versetzt |

Regeln:
- Übergang nur für interne Links (`FOLD_LINKS` in `imagony-motion.js`), nie für externe Links, `target=_blank`, Downloads, Anker auf derselben Seite oder Klicks mit Zusatztaste.
- `prefers-reduced-motion: reduce` schaltet alle Animationen ab; Links wechseln sofort.
- Zurück-Taste (bfcache) setzt Überblendung und gefaltete Buttons zurück.
- Sicherung: fällt das Skript aus, verschwindet die Decke der neuen Seite nach 1.6s per CSS.

## 6. Barrierefreiheit

- Alle Textkontraste ≥ 5.1:1 (siehe Tabelle).
- Fokus: `outline` wird von `clip-path` abgeschnitten, deshalb Innenrahmen über `::after` (2px, currentColor) bei Buttons; Links behalten `outline: 2px solid var(--iris)`.
- Prisma und Überblendung sind `aria-hidden`; das Prisma ist nicht im Tab-Fluss.
- Ticker ist Text, kein Bild.

## 7. Nicht tun

- Keine Rundungen, keine Schatten, keine Glows ausser dem einen Hintergrundlicht hinter dem Prisma.
- Kein Teal, kein Neongrün, kein „Matrix-Regen“.
- Keine weiteren Dauer-Animationen neben dem Prisma.
- Keine neuen Texte erfinden; Inhalte bleiben wie im Repo.
