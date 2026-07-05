/**
 * BoatOS Settings — Koordinator
 *
 * Vollbild-Settings-Seite (Master-Detail wie Helm).
 * Jeder Reiter ist ein eigenes Modul unter ./tabs/<id>.js und wird beim
 * ersten Öffnen per dynamic import() geladen (danach Idle-Prefetch der
 * restlichen Module für Offline-Betrieb und instant Tab-Wechsel).
 *
 * Modul-Contract (alle Tabs einheitlich):
 *   export const id = 'general';
 *   export const html = `...`;          // Sektion-Markup
 *   export function init(ctx) {}        // einmalig nach Injection
 *   export function load(s) {}          // Settings-Objekt -> DOM
 *   export function collect(s) {}       // DOM -> Settings-Objekt (nur eigene Keys)
 *   export function onShow(ctx) {}      // optional: bei jeder Aktivierung
 *
 * @module settings
 */

import { t, setLang } from '../i18n.js';

export const TAB_IDS = ['general', 'boat', 'map', 'nav', 'ais', 'charts', 'gps', 'data', 'routing', 'wifi', 'system'];

const API_URL = window.API_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${window.location.hostname}`);

// ==================== STATE ====================
let moduleContext = null;
let settingsState = {};              // kanonisches Settings-Objekt (Backend-merged)
const loadedTabs = new Map();        // id -> Modul
let activeTab = 'general';
let prefetchStarted = false;

// ==================== HELPERS ====================

export function setContext(ctx) {
    moduleContext = ctx;
}

function getUI() {
    return moduleContext?.ui || window.BoatOS?.ui;
}

function getCtx() {
    return { ...(moduleContext || {}), t, API_URL, getState: () => settingsState };
}

function showMsg(message, type = 'info') {
    const ui = getUI();
    if (ui?.showNotification) ui.showNotification(message, type);
    else console.log(`[${type}] ${message}`);
}

// ==================== SYNC (Boot + Open) ====================

/**
 * Settings von Backend + localStorage zusammenführen (Backend gewinnt)
 * und app-weite Seiteneffekte anwenden, die KEIN Settings-DOM brauchen
 * (Sprache, Tagesplanung für ETA). Läuft beim Boot und bei jedem Öffnen.
 */
export async function sync() {
    const ui = getUI();
    let settings = ui?.loadSettings ? ui.loadSettings() : {};

    try {
        const res = await fetch(`${API_URL}/api/settings`);
        const backendSettings = await res.json();
        if (backendSettings && backendSettings.boat?.name) {
            const merged = Object.assign({}, settings, backendSettings);
            if (ui?.saveSettings) ui.saveSettings(merged);
            else localStorage.setItem('boatos_settings', JSON.stringify(merged));
            settings = merged;
        }
    } catch (e) {
        console.warn('Backend-Settings nicht erreichbar, nutze localStorage:', e);
    }

    settingsState = settings;

    // Sprache anwenden (unabhängig vom Settings-DOM)
    if (settings.language) setLang(settings.language);

    // Tagesplanung an navigation.js weitergeben (für ETA-Berechnung)
    const navMod = moduleContext?.navigation;
    if (settings.navigation) {
        if (navMod?.setDailyTravelHours) navMod.setDailyTravelHours(settings.navigation.dailyTravelHours || 0);
        if (navMod?.setDayStartHour) {
            const parts = (settings.navigation.dayStartTime || '08:00').split(':');
            navMod.setDayStartHour(parseInt(parts[0]) || 8);
        }
        if (navMod?.refreshETADisplay) navMod.refreshETADisplay();
    }

    // Bereits geladene Tabs mit frischen Werten befüllen
    for (const mod of loadedTabs.values()) {
        try { mod.load?.(settingsState); } catch (e) { console.warn(`Tab ${mod.id}: load fehlgeschlagen`, e); }
    }

    return settingsState;
}

// ==================== OPEN / CLOSE ====================

function onKeyDown(e) {
    if (e.key === 'Escape') close();
}

export async function open(tabId) {
    const page = document.getElementById('settingsPage');
    if (!page) return;
    page.classList.add('open');
    document.addEventListener('keydown', onKeyDown);

    await sync();
    await showTab(tabId || activeTab);

    // Select-Restyling etc. (Listener in main.js hängt an document)
    document.dispatchEvent(new Event('settingsPanelOpened'));

    // Restliche Tab-Module im Leerlauf vorladen (Offline + instant Wechsel)
    if (!prefetchStarted) {
        prefetchStarted = true;
        const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
        idle(() => { TAB_IDS.forEach(id => { loadTabModule(id).catch(() => {}); }); });
    }
}

export function close() {
    const page = document.getElementById('settingsPage');
    if (page) page.classList.remove('open');
    document.removeEventListener('keydown', onKeyDown);
}

// ==================== TAB HANDLING ====================

async function loadTabModule(id) {
    if (loadedTabs.has(id)) return loadedTabs.get(id);
    const mod = await import(`./tabs/${id}.js`);
    // Nur einmal injizieren (Prefetch und showTab können konkurrieren)
    if (!loadedTabs.has(id)) {
        loadedTabs.set(id, mod);
        const container = document.getElementById('settingsContentInner');
        if (container && !document.getElementById(`settings-${id}`)) {
            const section = document.createElement('div');
            section.id = `settings-${id}`;
            section.classList.add('section-hidden');
            section.innerHTML = mod.html;
            container.appendChild(section);
            if (window.applyI18n) window.applyI18n(section);
            document.dispatchEvent(new Event('settingsPanelOpened'));
            try { mod.init?.(getCtx()); } catch (e) { console.warn(`Tab ${id}: init fehlgeschlagen`, e); }
            try { mod.load?.(settingsState); } catch (e) { console.warn(`Tab ${id}: load fehlgeschlagen`, e); }
            // Unit-Labels (kn/km/h, NM/km) in der frisch injizierten Sektion aktualisieren —
            // updateAllUnitLabels() lief beim Boot, bevor dieser DOM existierte
            window.updateAllUnitLabels?.();
        }
    }
    return loadedTabs.get(id);
}

export async function showTab(id) {
    let mod;
    try {
        mod = await loadTabModule(id);
    } catch (e) {
        console.error(`Settings-Tab '${id}' konnte nicht geladen werden:`, e);
        showMsg(`❌ Tab konnte nicht geladen werden (offline?)`, 'error');
        return;
    }

    activeTab = id;

    // Sektionen umschalten
    TAB_IDS.forEach(tid => {
        const section = document.getElementById(`settings-${tid}`);
        if (section) section.classList.toggle('section-hidden', tid !== id);
    });

    // Nav-Markierung + aktiven Chip in Sicht scrollen (schmale Screens)
    document.querySelectorAll('#settingsNav .settings-nav-item').forEach(item => {
        const isActive = item.dataset.tab === id;
        item.classList.toggle('active', isActive);
        if (isActive && item.scrollIntoView) {
            item.scrollIntoView({ inline: 'center', block: 'nearest' });
        }
    });

    // Content nach oben scrollen
    const content = document.getElementById('settingsContent');
    if (content) content.scrollTop = 0;

    try { mod.onShow?.(getCtx()); } catch (e) { console.warn(`Tab ${id}: onShow fehlgeschlagen`, e); }
}

// ==================== SAVE ====================

/**
 * Alle Einstellungen sammeln und speichern.
 * Geladene Tabs liefern ihre Werte per collect(); nie geöffnete Tabs
 * behalten die kanonischen Werte aus settingsState.
 */
export function save() {
    const ui = getUI();
    const settings = JSON.parse(JSON.stringify(settingsState));

    for (const mod of loadedTabs.values()) {
        try { mod.collect?.(settings); } catch (e) { console.warn(`Tab ${mod.id}: collect fehlgeschlagen`, e); }
    }

    settingsState = settings;

    // Lokal speichern
    if (ui?.saveSettings) ui.saveSettings(settings);
    else localStorage.setItem('boatos_settings', JSON.stringify(settings));

    // Ans Backend senden (AIS, Routing etc. werden sofort neu konfiguriert)
    fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    }).catch(err => console.warn('Settings-Backend-Sync fehlgeschlagen:', err));

    // Event für andere Module
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { settings } }));

    close();
    showMsg(t('settingsSaved'), 'success');
    console.log('Einstellungen gespeichert:', settings);
}
