/**
 * Settings-Tab: Über BoatOS (Logo, Version, Dank/Sponsoren, Links, Lizenz)
 *
 * Sponsoren werden beim Öffnen live aus dem Repo geladen
 * (raw.githubusercontent.com/.../main/sponsors.json). Kein Internet → leere
 * Liste, kein Absturz. Version kommt aus /api/system/version (.current = VERSION).
 */

export const id = 'about';

const SPONSORS_URL = 'https://raw.githubusercontent.com/bigbrainlabs/BoatOS/main/sponsors.json';

// Tier-Reihenfolge + Anzeige: First Mate zuerst, dann Crew
const TIERS = [
    { key: 'first_mate', label: 'First Mate' },
    { key: 'crew',       label: 'Crew' },
];

const LINKS = [
    { label: 'GitHub',        url: 'https://github.com/bigbrainlabs/BoatOS',              icon: '🐙' },
    { label: 'Buchreihe (DE)', url: 'https://amzn.to/4e5swN6',                            icon: '📕' },
    { label: 'Buchreihe (EN)', url: 'https://amzn.to/4vxWr5W',                            icon: '📗' },
    { label: 'Patreon',       url: 'https://www.patreon.com/cw/logbook_without_posing',   icon: '🎗️' },
];

/**
 * Datenquellen mit Nennungspflicht.
 *
 * ELWIS/WSV verlangt fuer die uebernommenen Inhalte ausdruecklich die
 * Quellenangabe „www.elwis.de" (openData, kommerzielle Nachnutzung erlaubt,
 * siehe Haftungsausschluss und Nutzungsbedingungen auf elwis.de). Der
 * Abschnitt ist bewusst als Liste angelegt — es kommen weitere Quellen dazu.
 */
const SOURCES = [
    { name: 'ELWIS / WSV', url: 'https://www.elwis.de',
      what: 'Schifffahrtszeichen (BinSchStrO Anlage 7), IENC-Seekarten' },
    { name: 'PegelOnline / WSV', url: 'https://www.pegelonline.wsv.de',
      what: 'Wasserstände, Gezeiten' },
    { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright',
      what: 'Kartendaten, Häfen und Ankerplätze (© OpenStreetMap-Mitwirkende)' },
    { name: 'OpenSeaMap', url: 'https://www.openseamap.org',
      what: 'Seezeichen-Overlay' },
];

export const html = `
                <div class="about-page">
                    <div class="about-hero">
                        <img class="about-logo" src="icons/icon.svg" alt="BoatOS" onerror="this.style.display='none'">
                        <div class="about-title">BoatOS</div>
                        <div class="about-version" id="about-version">…</div>
                        <div class="about-tagline">Open Source Marine OS for Raspberry Pi</div>
                    </div>

                    <div class="setting-group">
                        <h4 data-i18n="about_thanks">Danke an</h4>
                        <div id="about-sponsors" class="about-sponsors">
                            <div class="about-sponsors-loading" data-i18n="about_loading">Wird geladen…</div>
                        </div>
                    </div>

                    <div class="setting-group">
                        <h4 data-i18n="about_links">Links</h4>
                        <div class="about-links">
                            ${LINKS.map(l => `<a class="about-link" href="${l.url}" target="_blank" rel="noopener"><span>${l.icon}</span>${l.label} ↗</a>`).join('')}
                        </div>
                    </div>

                    <div class="setting-group">
                        <h4 data-i18n="about_support">Unterstützen</h4>
                        <div class="about-support">
                            <a class="about-btn about-btn-github" href="https://github.com/sponsors/bigbrainlabs" target="_blank" rel="noopener">💜 GitHub Sponsors</a>
                            <a class="about-btn about-btn-patreon" href="https://www.patreon.com/cw/logbook_without_posing" target="_blank" rel="noopener">🎗️ Patreon</a>
                        </div>
                    </div>

                    <div class="setting-group">
                        <h4 data-i18n="about_sources">Datenquellen</h4>
                        <div class="about-sources">
                            ${SOURCES.map(s => `
                            <div class="about-source">
                                <a href="${s.url}" target="_blank" rel="noopener">${s.name} ↗</a>
                                <span class="about-source-what">${s.what}</span>
                            </div>`).join('')}
                        </div>
                    </div>

                    <div class="setting-group">
                        <h4 data-i18n="about_disclaimer_h">Haftungsausschluss</h4>
                        <p class="about-disclaimer" data-i18n="about_disclaimer">BoatOS wird ohne jede Gewähr bereitgestellt („as is"), die Nutzung erfolgt auf eigenes Risiko. Für Schäden an Hard- oder Software, am Boot, an Personen oder für Folgeschäden wird keine Haftung übernommen. BoatOS ersetzt keine amtlichen Seekarten und keine sorgfältige Navigation — verlasse dich niemals allein auf diese Software.</p>
                    </div>

                    <div class="about-foot">
                        <span data-i18n="about_license">Lizenz</span>: GPL-3.0 · <span title="Buster">🐾</span>
                    </div>
                </div>
`;

export function init(ctx) {}
export function load(settings) {}
export function collect(settings) {}

export function onShow(ctx) {
    _loadVersion();
    _loadSponsors();
}

async function _loadVersion() {
    const el = document.getElementById('about-version');
    if (!el) return;
    try {
        const api = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
        const res = await fetch(`${api}/api/system/version`);
        const d = await res.json();
        el.textContent = d && d.current ? d.current : '—';
    } catch (_) {
        el.textContent = '—';
    }
}

async function _loadSponsors() {
    const box = document.getElementById('about-sponsors');
    if (!box) return;
    let sponsors = [];
    try {
        // cache:no-store + eigener Fehlerpfad → kein Absturz, wenn offline
        const res = await fetch(SPONSORS_URL, { cache: 'no-store' });
        if (res.ok) {
            const d = await res.json();
            if (d && Array.isArray(d.sponsors)) sponsors = d.sponsors;
        }
    } catch (_) {
        sponsors = [];
    }
    box.innerHTML = _renderSponsors(sponsors);
}

function _esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
}

function _renderSponsors(sponsors) {
    if (!sponsors.length) {
        // Graceful: nichts geladen (kein Netz) oder noch keine Sponsoren
        return `<div class="about-sponsors-empty" data-i18n="about_no_sponsors">Noch keine Einträge — oder offline.</div>`;
    }
    let html = '';
    for (const tier of TIERS) {
        const names = sponsors.filter(s => s && s.tier === tier.key && s.name).map(s => s.name);
        if (!names.length) continue;
        html += `
            <div class="about-tier">
                <div class="about-tier-label">${tier.label}</div>
                <div class="about-tier-names">${names.map(n => `<span class="about-sponsor">${_esc(n)}</span>`).join('')}</div>
            </div>`;
    }
    // Einträge mit unbekanntem Tier NICHT verschlucken — unter "Crew" einsortieren
    const known = new Set(TIERS.map(t => t.key));
    const others = sponsors.filter(s => s && s.name && !known.has(s.tier)).map(s => s.name);
    if (others.length) {
        html += `
            <div class="about-tier">
                <div class="about-tier-label">Crew</div>
                <div class="about-tier-names">${others.map(n => `<span class="about-sponsor">${_esc(n)}</span>`).join('')}</div>
            </div>`;
    }
    return html || `<div class="about-sponsors-empty" data-i18n="about_no_sponsors">Noch keine Einträge.</div>`;
}
