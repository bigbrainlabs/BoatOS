/**
 * Settings-Tab: System (Version/Update, Helm, Neustart/Herunterfahren)
 *
 * Die System-Logik lebt in js/system.js (BoatOS.system.*) — dieses Modul
 * liefert nur das Markup und stößt den Versions-Check an.
 */

export const id = 'system';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="settings_sys_version_h4">Software-Version</h4>
                    <div id="system-version-card" style="padding:14px; background:var(--bg-card); border-radius:8px; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span data-i18n="settings_sys_installed" style="color:var(--text-dim); font-size:13px;">Installiert</span>
                            <span id="system-ver-current" style="font-weight:600; color:var(--text);">—</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span data-i18n="settings_sys_available" style="color:var(--text-dim); font-size:13px;">Verfügbar</span>
                            <span id="system-ver-latest" style="font-weight:600; color:var(--text);">—</span>
                        </div>
                        <div id="system-ver-status" style="font-size:12px; color:var(--text-dim); margin-top:4px;"></div>
                    </div>
                    <button onclick="BoatOS.system.checkVersion()" data-i18n="settings_sys_check"
                        style="width:100%; padding:10px; background:var(--bg-card); color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:14px; cursor:pointer; margin-bottom:8px;">
                        🔄 Auf Updates prüfen
                    </button>
                    <button id="btn-system-update" onclick="BoatOS.system.startUpdate()" data-i18n="settings_sys_update"
                        style="display:none; width:100%; padding:12px; background:var(--accent); color:#fff; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer;">
                        ⬆️ Jetzt aktualisieren
                    </button>

                    <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border);">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span data-i18n="settings_sys_channel" style="font-size:14px; color:var(--text);">Update-Kanal</span>
                            <select id="system-update-channel" onchange="BoatOS.system.setChannel(this.value)"
                                style="padding:6px 10px; background:var(--bg-card); color:var(--text); border:1px solid var(--border); border-radius:6px; font-size:13px; cursor:pointer;">
                                <option value="stable" data-i18n="settings_sys_channel_stable">Stabil</option>
                                <option value="beta" data-i18n="settings_sys_channel_beta">Beta (Vorabversionen)</option>
                            </select>
                        </div>
                        <div data-i18n="settings_sys_channel_note" style="font-size:11px; color:var(--text-dim); margin-top:6px;">
                            Beta liefert Vorabversionen (rc) zum Testen — kann instabil sein.
                        </div>
                    </div>
                </div>

                <div class="setting-group" id="system-update-progress" style="display:none;">
                    <h4 data-i18n="settings_sys_update_progress_h4">Update-Fortschritt</h4>
                    <div id="system-update-log"
                        style="background:#0d1117; border:1px solid var(--border); border-radius:8px; padding:12px;
                               font-family:monospace; font-size:12px; color:#4fc3f7; max-height:260px;
                               overflow-y:auto; white-space:pre-wrap; line-height:1.5;">
                    </div>
                    <div data-i18n="settings_sys_update_note" style="margin-top:8px; font-size:12px; color:var(--text-dim);">
                        Der Pi startet automatisch neu sobald das Update abgeschlossen ist.
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_sys_helm_h4">Helm (Touchscreen-App)</h4>
                    <div style="padding:12px; background:var(--bg-card); border-radius:8px; margin-bottom:10px; font-size:13px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                            <span data-i18n="settings_sys_helm_display" style="color:var(--text-dim);">Display erkannt</span>
                            <span id="helm-display-detected" style="font-weight:600;">—</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span data-i18n="settings_sys_helm_running" style="color:var(--text-dim);">Helm läuft</span>
                            <span id="helm-running" style="font-weight:600;">—</span>
                        </div>
                    </div>
                    <label style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-card); border-radius:8px; cursor:pointer; margin-bottom:8px;">
                        <span data-i18n="settings_sys_helm_autostart" style="font-size:14px; color:var(--text);">Automatisch starten (bei Display)</span>
                        <input type="checkbox" id="helm-enabled-toggle" onchange="BoatOS.system.setHelmEnabled(this.checked)" style="width:18px; height:18px; cursor:pointer;">
                    </label>
                    <div style="display:flex; gap:8px; margin-bottom:8px;">
                        <button onclick="BoatOS.system.helmStart()" data-i18n="settings_sys_helm_start"
                            style="flex:1; padding:10px; background:var(--success,#4caf50); color:#fff; border:none; border-radius:8px; font-size:13px; cursor:pointer;">
                            ▶ Starten
                        </button>
                        <button onclick="BoatOS.system.helmStop()" data-i18n="settings_sys_helm_stop_btn"
                            style="flex:1; padding:10px; background:var(--bg-card); color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:13px; cursor:pointer;">
                            ⏹ Stoppen
                        </button>
                    </div>
                    <div data-i18n="settings_sys_helm_note" style="font-size:11px; color:var(--text-dim);">
                        ⚠️ Stoppen beendet den Touchscreen — Deck bleibt per Browser erreichbar.
                    </div>
                </div>

                <div class="setting-group">
                    <h4>System</h4>
                    <button onclick="BoatOS.system.reboot()" data-i18n="settings_sys_reboot"
                        style="width:100%; padding:10px; background:var(--bg-card); color:var(--text); border:1px solid var(--border); border-radius:8px; font-size:14px; cursor:pointer; margin-bottom:8px;">
                        🔄 Pi neu starten
                    </button>
                    <button onclick="BoatOS.system.shutdown()" data-i18n="settings_sys_shutdown"
                        style="width:100%; padding:10px; background:var(--danger); color:#fff; border:none; border-radius:8px; font-size:14px; cursor:pointer;">
                        🔴 Pi herunterfahren
                    </button>
                </div>
`;

export function init(ctx) {
    // System-Logik läuft über BoatOS.system (js/system.js)
}

export function load(settings) {
    // keine Settings-Felder in diesem Tab
}

export function collect(settings) {
    // keine Settings-Felder in diesem Tab
}

export function onShow(ctx) {
    if (window.BoatOS?.system) {
        const sel = document.getElementById('system-update-channel');
        if (sel && window.BoatOS.system.getChannel) sel.value = window.BoatOS.system.getChannel();
        window.BoatOS.system.checkVersion();
        window.BoatOS.system.loadHelmStatus();
    }
}
