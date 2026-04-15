/**
 * BoatOS WiFi Management
 * WLAN-Netzwerke scannen, verbinden, verwalten via NetworkManager API
 */

let _pendingSsid = null;
let _pendingSecurity = null;
let _statusInterval = null;

// Safely encode a JS value for use inside a single-quoted HTML onclick attribute
function attrJson(val) {
    return JSON.stringify(val).replace(/'/g, '&#39;');
}

// ==================== STATUS ====================

export async function loadStatus() {
    try {
        const res = await fetch('/api/wifi/status');
        const data = await res.json();
        renderStatus(data);
    } catch (e) {
        renderStatus({ connected: false, ssid: '', ip: '', signal: null });
    }
}

function renderStatus(data) {
    const dot   = document.getElementById('wifi-status-dot');
    const ssid  = document.getElementById('wifi-status-ssid');
    const ip    = document.getElementById('wifi-status-ip');
    const bars  = document.getElementById('wifi-signal-bars');
    const btnDis = document.getElementById('btn-wifi-disconnect');

    if (!dot) return;

    if (data.connected && data.ssid) {
        dot.style.background = '#2ecc71';
        ssid.textContent = data.ssid;
        ip.textContent   = data.ip ? `IP: ${data.ip}` : '';
        bars.textContent = signalBars(data.signal);
        if (btnDis) btnDis.style.display = 'block';
    } else {
        dot.style.background = 'var(--text-dim)';
        ssid.textContent = 'Nicht verbunden';
        ip.textContent   = '';
        bars.textContent = '';
        if (btnDis) btnDis.style.display = 'none';
    }
}

function signalBars(signal) {
    if (signal === null || signal === undefined) return '';
    if (signal >= 80) return '▂▄▆█';
    if (signal >= 60) return '▂▄▆_';
    if (signal >= 40) return '▂▄__';
    if (signal >= 20) return '▂___';
    return '____';
}

// ==================== SCAN ====================

export async function scan() {
    const btn  = document.getElementById('btn-wifi-scan');
    const list = document.getElementById('wifi-scan-list');
    if (!list) return;

    btn.textContent = 'Scanne…';
    btn.disabled = true;
    list.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:8px 0">Suche Netzwerke…</div>';

    try {
        const res  = await fetch('/api/wifi/scan');
        const data = await res.json();
        renderScanList(data.networks || []);
    } catch (e) {
        list.innerHTML = '<div style="color:var(--danger);font-size:13px;">Scan fehlgeschlagen</div>';
    } finally {
        btn.textContent = 'Netzwerke scannen';
        btn.disabled = false;
    }
}

function renderScanList(networks) {
    const list = document.getElementById('wifi-scan-list');
    if (!list) return;

    if (networks.length === 0) {
        list.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:8px 0">Keine Netzwerke gefunden</div>';
        return;
    }

    list.innerHTML = networks.map(n => {
        const bars     = signalBars(n.signal);
        const lock     = n.security === 'wpa' ? '🔒 ' : '';
        const active   = n.in_use ? ' style="border-color:var(--accent)"' : '';
        const activeTag = n.in_use ? '<span style="color:var(--accent);font-size:11px;margin-left:6px;">verbunden</span>' : '';
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                    background:var(--bg-card);border-radius:8px;border:1px solid var(--border)"${active}>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(n.ssid)}${activeTag}</div>
                <div style="font-size:11px;color:var(--text-dim);">${lock}${bars}  CH${n.channel}</div>
            </div>
            <button onclick='BoatOS.wifi.startConnect(${attrJson(n.ssid)}, ${attrJson(n.security)})'
                style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap;">
                ${n.in_use ? 'Erneut' : 'Verbinden'}
            </button>
        </div>`;
    }).join('');
}

// ==================== CONNECT ====================

export function startConnect(ssid, security) {
    _pendingSsid     = ssid;
    _pendingSecurity = security;

    if (security === 'open') {
        // open network — connect directly
        doConnect(ssid, '');
        return;
    }

    // show password modal
    const modal = document.getElementById('wifi-pw-modal');
    const label = document.getElementById('wifi-pw-ssid-label');
    const input = document.getElementById('wifi-pw-input');
    if (modal) {
        label.textContent = ssid;
        input.value = '';
        modal.style.display = 'flex';
        setTimeout(() => input.focus(), 100);
    }
}

export function cancelConnect() {
    const modal = document.getElementById('wifi-pw-modal');
    if (modal) modal.style.display = 'none';
    _pendingSsid = null;
}

export async function confirmConnect() {
    const input = document.getElementById('wifi-pw-input');
    const pw    = input ? input.value : '';
    const modal = document.getElementById('wifi-pw-modal');
    if (modal) modal.style.display = 'none';
    if (_pendingSsid) await doConnect(_pendingSsid, pw);
    _pendingSsid = null;
}

async function doConnect(ssid, password) {
    const list = document.getElementById('wifi-scan-list');
    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--accent);font-size:13px;padding:8px 0;';
    msg.textContent = `Verbinde mit ${ssid}…`;
    if (list) list.prepend(msg);

    try {
        const res  = await fetch('/api/wifi/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssid, password })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            msg.style.color = '#2ecc71';
            msg.textContent = `Verbunden mit ${ssid}`;
            await loadStatus();
            await loadSaved();
        } else {
            msg.style.color = 'var(--danger)';
            msg.textContent = `Fehler: ${data.message}`;
        }
    } catch (e) {
        msg.style.color = 'var(--danger)';
        msg.textContent = 'Verbindung fehlgeschlagen';
    }
    setTimeout(() => msg.remove(), 5000);
}

// ==================== SAVED NETWORKS ====================

export async function loadSaved() {
    const list = document.getElementById('wifi-saved-list');
    if (!list) return;
    try {
        const res  = await fetch('/api/wifi/networks');
        const data = await res.json();
        renderSaved(data.networks || []);
    } catch (e) {
        list.innerHTML = '<div style="color:var(--danger);font-size:13px;">Fehler beim Laden</div>';
    }
}

function renderSaved(networks) {
    const list = document.getElementById('wifi-saved-list');
    if (!list) return;

    if (networks.length === 0) {
        list.innerHTML = '<div style="color:var(--text-dim);font-size:13px;">Keine gespeicherten Netzwerke</div>';
        return;
    }

    list.innerHTML = networks.map(n => {
        const activeTag = n.active ? '<span style="color:var(--accent);font-size:11px;margin-left:6px;">aktiv</span>' : '';
        const connectBtn = n.active ? '' : `
            <button onclick='BoatOS.wifi.connectSaved(${attrJson(n.name)})'
                style="padding:6px 12px;background:var(--accent);color:#fff;border:none;
                       border-radius:6px;cursor:pointer;font-size:12px;">
                Verbinden
            </button>`;
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                    background:var(--bg-card);border-radius:8px;border:1px solid var(--border);">
            <div style="flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(n.name)}${activeTag}</div>
            ${connectBtn}
            <button onclick='BoatOS.wifi.forgetNetwork(${attrJson(n.uuid)}, ${attrJson(n.name)})'
                style="padding:6px 12px;background:transparent;color:var(--danger);border:1px solid var(--danger);
                       border-radius:6px;cursor:pointer;font-size:12px;">
                Löschen
            </button>
        </div>`;
    }).join('');
}

export async function connectSaved(name) {
    const list = document.getElementById('wifi-saved-list');
    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--accent);font-size:13px;padding:8px 0;';
    msg.textContent = `Verbinde mit ${name}…`;
    if (list) list.prepend(msg);
    try {
        const res  = await fetch('/api/wifi/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ssid: name, password: '' })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            msg.style.color = '#2ecc71';
            msg.textContent = `Verbunden mit ${name}`;
            await loadStatus();
            await loadSaved();
        } else {
            msg.style.color = 'var(--danger)';
            msg.textContent = `Fehler: ${data.message}`;
        }
    } catch (e) {
        msg.style.color = 'var(--danger)';
        msg.textContent = 'Verbindung fehlgeschlagen';
    }
    setTimeout(() => msg.remove(), 5000);
}

export async function forgetNetwork(uuid, name) {
    try {
        const res  = await fetch(`/api/wifi/networks/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'ok') {
            await loadSaved();
            await loadStatus();
        }
    } catch (e) {
        // ignore
    }
}

// ==================== DISCONNECT ====================

export async function disconnect() {
    try {
        await fetch('/api/wifi/disconnect', { method: 'POST' });
        await loadStatus();
    } catch (e) {
        // ignore
    }
}

// ==================== INIT ====================

export function initWifi() {
    loadStatus();
    loadSaved();
    // Refresh status every 10s while wifi tab is visible
    _statusInterval = setInterval(() => {
        const tab = document.getElementById('settings-wifi');
        if (tab && !tab.classList.contains('section-hidden')) {
            loadStatus();
        }
    }, 10000);
}

// ==================== UTIL ====================

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
