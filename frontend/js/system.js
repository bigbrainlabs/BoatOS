/**
 * BoatOS System — Version check & OTA update
 */

const API = '';
let _pollTimer = null;

export async function checkVersion() {
    const elCurrent = document.getElementById('system-ver-current');
    const elLatest  = document.getElementById('system-ver-latest');
    const elStatus  = document.getElementById('system-ver-status');
    const btnUpdate = document.getElementById('btn-system-update');
    if (!elCurrent) return;

    elCurrent.textContent = '…';
    elLatest.textContent  = '…';
    elStatus.textContent  = '';
    if (btnUpdate) btnUpdate.style.display = 'none';

    try {
        const res  = await fetch(`${API}/api/system/version`);
        const data = await res.json();

        elCurrent.textContent = data.current || '—';
        elLatest.textContent  = data.latest  || '—';

        if (data.up_to_date) {
            elStatus.textContent = '✅ System ist aktuell';
            elStatus.style.color = 'var(--success, #4caf50)';
        } else if (data.latest === 'unbekannt') {
            elStatus.textContent = '⚠️ Keine Verbindung zu GitHub';
            elStatus.style.color = 'var(--warning, #ff9800)';
        } else {
            elStatus.textContent = `🆕 Update verfügbar${data.published_at ? ' · ' + _fmtDate(data.published_at) : ''}`;
            elStatus.style.color = 'var(--accent)';
            if (btnUpdate) btnUpdate.style.display = 'block';
        }
    } catch (e) {
        if (elStatus) {
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
    } catch (_) { /* Pi antwortet nach dem Reboot nicht mehr */ }

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
        if (!data.running) clearInterval(_pollTimer);
    } catch (_) {
        // Pi neugestartet — Polling stoppen
        if (logEl) logEl.textContent += '\n[System] Verbindung getrennt — Pi startet neu…';
        clearInterval(_pollTimer);
    }
}

export async function shutdown() {
    if (!confirm('Pi jetzt herunterfahren?')) return;
    try { await fetch('/api/system/shutdown', { method: 'POST' }); } catch (_) {}
}

function _fmtDate(iso) {
    try {
        return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
    } catch (_) { return ''; }
}
