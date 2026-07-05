/**
 * Settings-Tab: Daten (Export/Import/Reset, Schleusen-Datenbank)
 *
 * Alle Buttons werden in init() per addEventListener gebunden — die alten
 * Inline-Handler (BoatOS.settings.*) waren nie am Namespace registriert.
 */

export const id = 'data';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="data_settings">Daten-Verwaltung</h4>
                    <div class="setting-item">
                        <button id="btn-data-export" class="btn-secondary" data-i18n="data_export_settings" style="width: 100%;">
                            📥 Einstellungen exportieren
                        </button>
                    </div>
                    <div class="setting-item">
                        <button id="btn-data-import" class="btn-secondary" data-i18n="data_import_settings" style="width: 100%;">
                            📤 Einstellungen importieren
                        </button>
                    </div>
                    <div class="setting-item">
                        <button id="btn-data-reset" class="btn-secondary" data-i18n="data_reset_settings" style="width: 100%; background: var(--warning);">
                            🔄 Auf Standardwerte zurücksetzen
                        </button>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_lock_db_section">🗄️ Schleusen-Datenbank</h4>
                    <small style="color: var(--text-dim); display: block; margin-bottom: 15px;">
                        Verwalte die Schleusen-Datenbank: OSM-Import, Datenanreicherung und Qualitätsprüfung.
                    </small>

                    <div class="setting-item">
                        <button id="btn-locks-import" class="btn-secondary" data-i18n="settings_import_osm" style="width: 100%;">
                            🌍 Schleusen von OSM importieren
                        </button>
                        <small style="color: var(--text-dim); display: block; margin-top: 5px;">
                            Lädt Schleusen aus OpenStreetMap für alle aktiven Karten-Regionen
                        </small>
                    </div>

                    <div class="setting-item">
                        <button id="btn-locks-enrich" class="btn-secondary" data-i18n="settings_enrich_data" style="width: 100%;">
                            ✨ Daten anreichern
                        </button>
                        <small style="color: var(--text-dim); display: block; margin-top: 5px;">
                            Ergänzt VHF-Kanäle, Kontaktdaten und weitere Infos
                        </small>
                    </div>

                    <div class="setting-item">
                        <button id="btn-locks-quality" class="btn-secondary" data-i18n="settings_quality_report" style="width: 100%;">
                            📊 Qualitätsbericht anzeigen
                        </button>
                        <small style="color: var(--text-dim); display: block; margin-top: 5px;">
                            Zeigt Statistiken zur Datenqualität (VHF-Abdeckung, Kontakte, etc.)
                        </small>
                    </div>

                    <div class="setting-item">
                        <button id="btn-locks-verify" class="btn-secondary" data-i18n="settings_verify_positions" style="width: 100%;">
                            📍 Positionen überprüfen & korrigieren
                        </button>
                        <small style="color: var(--text-dim); display: block; margin-top: 5px;">
                            Prüft alle Schleusen-Positionen gegen OpenStreetMap und korrigiert Fehler (>500m Abweichung)
                        </small>
                    </div>

                    <div id="locks-quality-report" style="display: none; margin-top: 15px; padding: 15px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--accent);">
                        <h4 style="margin: 0 0 10px 0; color: var(--accent);">📊 Datenqualität</h4>
                        <pre id="locks-quality-content" style="color: var(--text-dim); font-size: 11px; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; margin: 0;"></pre>
                    </div>
                </div>
`;

let API_URL = '';
let _t = (k, p) => k;
let _ui = null;

function showMsg(message) {
    if (_ui?.showNotification) _ui.showNotification(message, 'info');
    else console.log(message);
}

export function init(ctx) {
    API_URL = ctx.API_URL || '';
    _t = ctx.t || _t;
    _ui = ctx.ui || window.BoatOS?.ui;

    const bind = (btnId, fn) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener('click', fn);
    };
    bind('btn-data-export', exportSettings);
    bind('btn-data-import', importSettings);
    bind('btn-data-reset', resetSettings);
    bind('btn-locks-import', importLocksFromOSM);
    bind('btn-locks-enrich', enrichLocksData);
    bind('btn-locks-quality', checkLocksQuality);
    bind('btn-locks-verify', verifyLocksPositions);
}

export function load(settings) {
    // keine Settings-Felder in diesem Tab
}

export function collect(settings) {
    // keine Settings-Felder in diesem Tab
}

// ==================== DATEN-VERWALTUNG ====================

export function resetSettings() {
    if (!confirm(_t('settingsResetConfirm'))) return;

    localStorage.removeItem('boatos_settings');
    showMsg(_t('settingsReset'));
    setTimeout(() => location.reload(), 1000);
}

export async function exportSettings() {
    showMsg(_t('settingsExporting'));
    try {
        const res = await fetch(`${API_URL}/api/data/export`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cd = res.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename=([^;]+)/);
        link.download = match ? match[1] : `boatos_export_${new Date().toISOString().slice(0,10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showMsg(_t('settingsExported'));
    } catch (e) {
        showMsg(_t('settingsExportError', { error: e.message }));
    }
}

export function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        showMsg(_t('settingsImporting'));
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const res = await fetch(`${API_URL}/api/data/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.status === 'error') throw new Error(result.error);

            const imp = result.imported || {};
            const parts = [];
            if (imp.settings)          parts.push('Einstellungen');
            if (imp.gps_device)        parts.push('GPS-Gerät');
            if (imp.logbook_trips > 0) parts.push(`${imp.logbook_trips} Logbuch-Einträge`);
            if (imp.crew_members > 0)  parts.push(`${imp.crew_members} Crewmitglieder`);
            if (imp.fuel_entries > 0)  parts.push(`${imp.fuel_entries} Tankeinträge`);

            const items = parts.join(', ') || _t('settingsImportNothing');
            showMsg(_t('settingsImported', { items }));

            if (result.errors?.length) {
                console.warn('Import-Warnungen:', result.errors);
            }

            setTimeout(() => location.reload(), 1500);
        } catch (error) {
            console.error('Import error:', error);
            showMsg(_t('settingsImportError', { error: error.message }));
        }
    };

    input.click();
}

// ==================== SCHLEUSEN-DATENBANK ====================

/**
 * Gemeinsamer Runner für alle Schleusen-Hintergrund-Jobs (Import, Anreichern,
 * Positions-Korrektur): Job per POST starten, Status pollen, Fortschritt als
 * Toast anzeigen, am Ende onDone(result) aufrufen.
 */
async function runLocksJob(startUrl, onDone) {
    const response = await fetch(startUrl, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const start = await response.json();
    if (!start.success) throw new Error(start.error || '?');

    let lastProgress = '';
    const poll = setInterval(async () => {
        try {
            const st = await fetch(`${API_URL}/api/locks/job/status`).then(r => r.json());
            if (st.running) {
                if (st.progress && st.progress !== lastProgress) {
                    lastProgress = st.progress;
                    showMsg(`🔒 ${st.progress}`);
                }
                return;
            }
            clearInterval(poll);
            onDone(st.result || {});
        } catch (e) {
            clearInterval(poll);
            onDone({ success: false, error: e.message });
        }
    }, 3000);
}

export async function importLocksFromOSM() {
    if (!confirm(_t('settingsLocksImportConfirm'))) return;

    showMsg(_t('settingsLocksImportStart'));

    try {
        await runLocksJob(`${API_URL}/api/locks/import-osm`, (result) => {
            if (result.success) {
                showMsg(_t('settingsLocksImported', { imported: result.imported, updated: result.updated ?? 0 }));
                if (typeof window.updateLocksOnMap === 'function') window.updateLocksOnMap();
            } else {
                showMsg(_t('settingsLocksImportError', { error: result.error || '?' }));
            }
        });
    } catch (error) {
        console.error('OSM Import error:', error);
        showMsg(_t('settingsLocksImportError', { error: error.message }));
    }
}

export async function enrichLocksData() {
    if (!confirm('Möchten Sie die Schleusen-Daten anreichern?\n\nVHF-Kanäle, Kontaktdaten und weitere Infos werden ergänzt.')) return;

    showMsg(_t('settingsLocksEnrichStart'));

    try {
        await runLocksJob(`${API_URL}/api/locks/enrich`, (result) => {
            if (result.success) {
                showMsg(_t('settingsLocksEnriched', { enriched: result.enriched }));
                if (typeof window.updateLocksOnMap === 'function') window.updateLocksOnMap();
                setTimeout(() => checkLocksQuality(), 1000);
            } else {
                showMsg(_t('settingsLocksEnrichError', { error: result.error }));
            }
        });
    } catch (error) {
        console.error('Enrichment error:', error);
        showMsg(_t('settingsLocksEnrichError', { error: error.message }));
    }
}

export async function checkLocksQuality() {
    showMsg(_t('settingsQualityLoading'));

    try {
        const response = await fetch(`${API_URL}/api/locks/quality`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result.success) {
            const report = `
Gesamtzahl Schleusen: ${result.total}

═══ VHF-Kanäle ═══
Mit VHF: ${result.vhf_count}/${result.total} (${result.vhf_percentage})

═══ Kontaktdaten ═══
Telefonnummern: ${result.phone_count}/${result.total} (${result.phone_percentage})
E-Mail-Adressen: ${result.email_count}/${result.total} (${result.email_percentage})

═══ Technische Daten ═══
Abmessungen (L × B): ${result.dimensions_count}/${result.total} (${result.dimensions_percentage})
Kilometer-Marken: ${result.km_count}/${result.total} (${result.km_percentage})

═══ Zusatzinformationen ═══
Notizen/Hinweise: ${result.notes_count}/${result.total} (${result.notes_percentage})

═══ Top Wasserstraßen ═══
${result.top_waterways?.map(w => `${w.waterway}: ${w.count} Schleusen`).join('\n') || 'Keine Daten'}

Datenstand: ${new Date().toLocaleString('de-DE')}
            `.trim();

            const contentEl = document.getElementById('locks-quality-content');
            const reportEl = document.getElementById('locks-quality-report');
            if (contentEl) contentEl.textContent = report;
            if (reportEl) reportEl.style.display = 'block';

            showMsg(_t('settingsQualityLoaded'));
        } else {
            showMsg(_t('settingsQualityError', { error: result.error }));
        }
    } catch (error) {
        console.error('Quality check error:', error);
        showMsg(_t('settingsQualityError', { error: error.message }));
    }
}

export async function verifyLocksPositions() {
    if (!confirm(_t('settingsPosConfirm'))) return;

    showMsg(_t('settingsPosStart'));

    try {
        await runLocksJob(`${API_URL}/api/locks/verify-positions`, (result) => {
            if (result.success) {
                showMsg(_t('settingsPosChecked', { checked: result.checked }) +
                        ` (${result.fixed ?? 0} korrigiert, ${result.removed_duplicates ?? 0} Duplikate entfernt)`);
                if (typeof window.updateLocksOnMap === 'function') {
                    setTimeout(() => window.updateLocksOnMap(), 1000);
                }
            } else {
                showMsg(_t('settingsLocksImportError', { error: result.error }));
            }
        });
    } catch (error) {
        console.error('Position verification error:', error);
        showMsg(_t('settingsLocksImportError', { error: error.message }));
    }
}
