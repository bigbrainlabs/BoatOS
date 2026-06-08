/**
 * BoatOS System — Version check & OTA update
 */

const API = '';
let _pollTimer = null;
let _autoCheckTimer = null;

function _setBadge(visible) {
    const badge = document.getElementById('update-badge');
    if (badge) badge.style.display = visible ? 'flex' : 'none';
}

export async function autoCheck() {
    await _fetchVersion(false);
    if (_autoCheckTimer) clearInterval(_autoCheckTimer);
    _autoCheckTimer = setInterval(() => _fetchVersion(false), 6 * 60 * 60 * 1000);
}

export async function checkVersion() {
    await _fetchVersion(true);
}

async function _fetchVersion(updateUI) {
    const elCurrent = document.getElementById('system-ver-current');
    const elLatest  = document.getElementById('system-ver-latest');
    const elStatus  = document.getElementById('system-ver-status');
    const btnUpdate = document.getElementById('btn-system-update');

    if (updateUI && elCurrent) {
        elCurrent.textContent = '…';
        elLatest.textContent  = '…';
        elStatus.textContent  = '';
        if (btnUpdate) btnUpdate.style.display = 'none';
    }

    try {
        const res  = await fetch(`${API}/api/system/version`);
        const data = await res.json();

        if (updateUI && elCurrent) {
            elCurrent.textContent = data.current || '—';
            elLatest.textContent  = data.latest  || '—';
        }

        if (data.up_to_date) {
            _setBadge(false);
            if (updateUI && elStatus) {
                elStatus.textContent = '✅ System ist aktuell';
                elStatus.style.color = 'var(--success, #4caf50)';
            }
        } else if (data.latest === 'unbekannt') {
            _setBadge(false);
            if (updateUI && elStatus) {
                elStatus.textContent = '⚠️ Keine Verbindung zu GitHub';
                elStatus.style.color = 'var(--warning, #ff9800)';
            }
        } else {
            _setBadge(true);
            if (updateUI && elStatus) {
                elStatus.textContent = `🆕 Update verfügbar${data.published_at ? ' · ' + _fmtDate(data.published_at) : ''}`;
                elStatus.style.color = 'var(--accent)';
                if (btnUpdate) btnUpdate.style.display = 'block';
            }
        }
    } catch (e) {
        // On error: never show badge (fail safe — don't claim update available)
        _setBadge(false);
        if (updateUI && elStatus) {
            elStatus.textContent = '❌ Versionsabfrage fehlgeschlagen';
            elStatus.style.color = 'var(--danger)';
        }
    }
}

export async function startUpdate() {
    const btnUpdate = document.getElementById('btn-system-update');
    const progress  = document.getElementById('system-update-progress');
    const logEl     = document.getElementById('system-update-log');

    if (!confirm('System jetzt aktualisieren?\nDer Pi startet nach dem Update automatisch neu.')) return;

    if (btnUpdate) btnUpdate.style.display = 'none';
    if (progress)  progress.style.display  = 'block';
    if (logEl)     logEl.textContent = '';

    try {
        await fetch('/api/system/update', { method: 'POST' });
    } catch (_) {}

    _startPoll();
}

function _startPoll() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(_pollStatus, 1500);
}

async function _pollStatus() {
    const logEl = document.getElementById('system-update-log');
    if (!logEl) { clearInterval(_pollTimer); return; }

    try {
        const res  = await fetch('/api/system/update/status');
        const data = await res.json();
        logEl.textContent = data.log.join('\n');
        logEl.scrollTop   = logEl.scrollHeight;
        if (!data.running) {
            clearInterval(_pollTimer);
            _setBadge(false);
        }
    } catch (_) {
        if (logEl) logEl.textContent += '\n[System] Verbindung getrennt — Pi startet neu…';
        clearInterval(_pollTimer);
    }
}

export async function reboot() {
    if (!confirm('Pi jetzt neu starten?')) return;
    try { await fetch('/api/system/reboot', { method: 'POST' }); } catch (_) {}
}

export async function shutdown() {
    if (!confirm('Pi jetzt herunterfahren?')) return;
    try { await fetch('/api/system/shutdown', { method: 'POST' }); } catch (_) {}
}

export async function loadHelmStatus() {
    try {
        const res = await fetch(`${API}/api/system/helm`, { cache: 'no-store' });
        const d = await res.json();
        const elDetected = document.getElementById('helm-display-detected');
        const elRunning  = document.getElementById('helm-running');
        const toggle     = document.getElementById('helm-enabled-toggle');
        if (elDetected) elDetected.textContent = d.detected ? '✅ Ja' : '❌ Nein';
        if (elRunning)  elRunning.textContent  = d.running  ? '✅ Läuft' : '⏹ Gestoppt';
        if (toggle)     toggle.checked = d.enabled;
    } catch (_) {}
}

export async function setHelmEnabled(enabled) {
    try {
        await fetch(`${API}/api/system/helm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
        });
        setTimeout(loadHelmStatus, 1500);
    } catch (_) {}
}

export async function helmStart() {
    try {
        await fetch(`${API}/api/system/helm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true }),
        });
        setTimeout(loadHelmStatus, 2500);
    } catch (_) {}
}

export async function helmStop() {
    if (!confirm('Helm (Touchscreen-App) jetzt stoppen?\nDeck bleibt über den Browser erreichbar.')) return;
    try {
        await fetch(`${API}/api/system/helm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
        });
        setTimeout(loadHelmStatus, 2500);
    } catch (_) {}
}

function _fmtDate(iso) {
    try {
        return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
    } catch (_) { return ''; }
}
