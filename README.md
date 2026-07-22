# BoatOS — Website

Dieser Zweig enthält **ausschließlich die Projektseite**, die unter
<https://bigbrainlabs.github.io/BoatOS/> ausgeliefert wird.

| Datei            | Zweck                                                        |
|------------------|--------------------------------------------------------------|
| `index.html`     | die komplette Seite — Markup, CSS und JS in einer Datei       |
| `3d-preview.gif` | Vorschau der 3D-Kartenansicht (Kopie aus `v1.9.x-dev`)        |
| `.nojekyll`      | schaltet die Jekyll-Verarbeitung ab, die Seite ist fertig     |

## Kein Quellcode hier

Der eigentliche Quellcode liegt auf `main` (Stable), `develop` (Beta) und den
Feature-Zweigen. Bis Juli 2026 lag hier eine vollständige, eingefrorene Kopie
des Repos aus der v1.6.4-Zeit mit — sie wurde nie ausgeliefert, war aber beim
Auschecken von `gh-pages` verwirrend, weil sie wie aktueller Code aussah.
Sie steht weiterhin in der Historie dieses Zweigs, falls sie je gebraucht wird.

## Änderungen

`index.html` bearbeiten, committen, pushen — GitHub Pages baut automatisch neu
(dauert etwa eine Minute). Danach lohnt ein Blick auf die Live-Seite, denn ein
Tippfehler im Markup fällt lokal nicht zwangsläufig auf.

Die Seite ist zweisprachig: jeder Text existiert als `<span class="lang-en">`
und `<span class="lang-de">`, umgeschaltet über `data-lang` am `<body>`. Wer
einen Satz ergänzt, ergänzt beide Sprachen — sonst fehlt er in einer Fassung
ersatzlos.
