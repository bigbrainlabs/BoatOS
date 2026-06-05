/**
 * BoatOS WiFi Management
 * WLAN-Netzwerke scannen, verbinden, verwalten via NetworkManager API
 */

import { t } from './i18n.js';

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
        const [statusRes, hotspotRes] = await Promise.all([
            fetch('/api/wifi/status'),
            fetch('/api/wifi/hotspot'),
        ]);
        const data    = await statusRes.json();
        const hotspot = await hotspotRes.json();
        renderStatus(data);
        _renderHotspotBanner(hotspot);
    } catch (e) {
        renderStatus({ connected: false, ssid: '', ip: '', signal: null });
    }
}

function _renderHotspotBanner(hotspot) {
    const existing = document.getElementById('hotspot-banner');
    if (!hotspot?.active) {
        if (existing) existing.remove();
        const startBtn = document.getElementById('btn-hotspot-start');
        if (startBtn) startBtn.style.display = 'block';
        const stopBtn  = document.getElementById('btn-hotspot-stop');
        if (stopBtn)  stopBtn.style.display = 'none';
        return;
    }
    // Hotspot aktiv — Start-Button verstecken, Stop zeigen
    const startBtn = document.getElementById('btn-hotspot-start');
    if (startBtn) startBtn.style.display = 'none';
    const stopBtn = document.getElementById('btn-hotspot-stop');
    if (stopBtn) stopBtn.style.display = 'block';

    if (existing) {
        // Infos aktualisieren ohne neu zu bauen
        const info = existing.querySelector('.hotspot-info');
        if (info) info.innerHTML = _hotspotInfoHtml(hotspot);
        return;
    }
    const banner = document.createElement('div');
    banner.id = 'hotspot-banner';
    banner.style.cssText = 'background:#2D1E00;border:1px solid rgba(255,152,0,0.5);color:#E6EDF3;' +
        'padding:12px 14px;border-radius:8px;margin-bottom:12px;font-size:13px;line-height:1.6;';
    banner.innerHTML =
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">` +
        `<span style="color:#FF9800;font-weight:700;">${t('wifiHotspotActive')}</span></div>` +
        `<div class="hotspot-info" style="font-size:12px;color:#CCC;">${_hotspotInfoHtml(hotspot)}</div>`;
    const group = document.querySelector('#settings-wifi .setting-group');
    if (group) group.prepend(banner);
}

function _hotspotInfoHtml(h) {
    return `SSID: <b>${h.ssid}</b><br>Passwort: <b>${h.password}</b><br>IP: <b>${h.ip}</b>`;
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
        ssid.textContent = t('wifiNotConnected');
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

    btn.textContent = t('wifiScanning');
    btn.disabled = true;
    list.innerHTML = `<div style="color:var(--text-dim);font-size:13px;padding:8px 0">${t('wifiSearching')}</div>`;

    try {
        const res  = await fetch('/api/wifi/scan');
        const data = await res.json();
        renderScanList(data.networks || []);
    } catch (e) {
        list.innerHTML = '<div style="color:var(--danger);font-size:13px;">Scan fehlgeschlagen</div>';
    } finally {
        btn.textContent = t('wifiScanBtn');
        btn.disabled = false;
    }
}

function renderScanList(networks) {
    const list = document.getElementById('wifi-scan-list');
    if (!list) return;

    if (networks.length === 0) {
        list.innerHTML = `<div style="color:var(--text-dim);font-size:13px;padding:8px 0">${t('wifiNoneFound')}</div>`;
        return;
    }

    list.innerHTML = networks.map(n => {
        const bars      = signalBars(n.signal);
        const lock      = n.security === 'wpa' && !n.saved ? ' 🔒' : '';
        const savedTag  = n.saved ? ` <span style="color:var(--accent);font-size:10px;">${t('wifiSavedTag')}</span>` : '';
        const activeTag = n.in_use ? ` <span style="color:#2ecc71;font-size:11px;">${t('wifiConnectedTag')}</span>` : '';
        const border    = n.in_use ? 'border-color:#2ecc71' : n.saved ? 'border-color:var(--accent)' : '';
        const forgetBtn = n.saved ? `
            <button onclick='BoatOS.wifi.forgetNetwork(${attrJson(n.uuid)}, ${attrJson(n.ssid)})'
                title="Gespeichertes Profil löschen"
                style="padding:6px 10px;background:transparent;color:var(--danger);border:1px solid var(--danger);
                       border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;">
                ${t('wifiForget')}
            </button>` : '';
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;
                    background:var(--bg-card);border-radius:8px;border:1px solid var(--border);${border}">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    ${escHtml(n.ssid)}${activeTag}${savedTag}
                </div>
                <div style="font-size:11px;color:var(--text-dim);">${bars}${lock}  CH${n.channel}</div>
            </div>
            ${forgetBtn}
            <button onclick='BoatOS.wifi.startConnect(${attrJson(n.ssid)}, ${attrJson(n.security)}, ${!!n.saved})'
                style="padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap;">
                ${n.in_use ? 'Erneut' : 'Verbinden'}
            </button>
        </div>`;
    }).join('');
}

// ==================== CONNECT ====================

export function startConnect(ssid, security, saved = false) {
    _pendingSsid     = ssid;
    _pendingSecurity = security;

    // Kein Passwort nötig: offenes Netz oder Profil bereits gespeichert
    if (security === 'open' || saved) {
        doConnect(ssid, '');
        return;
    }

    // Passwort-Modal zeigen
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
            await Promise.all([loadStatus(), loadSaved(), scan()]);
        } else {
            msg.style.color = 'var(--danger)';
            msg.textContent = t('wifiConnectError', { message: data.message });
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
        list.innerHTML = `<div style="color:var(--danger);font-size:13px;">${t('wifiLoadError')}</div>`;
    }
}

function renderSaved(networks) {
    const list = document.getElementById('wifi-saved-list');
    if (!list) return;

    if (networks.length === 0) {
        list.innerHTML = `<div style="color:var(--text-dim);font-size:13px;">${t('wifiNoSaved')}</div>`;
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
            msg.textContent = t('wifiConnectError', { message: data.message });
        }
    } catch (e) {
        msg.style.color = 'var(--danger)';
        msg.textContent = 'Verbindung fehlgeschlagen';
    }
    setTimeout(() => msg.remove(), 5000);
}

export async function forgetNetwork(uuid, name) {
    if (!confirm(`Gespeichertes Profil "${name}" wirklich löschen?`)) return;
    try {
        const url = uuid
            ? `/api/wifi/networks/${encodeURIComponent(uuid)}`
            : `/api/wifi/networks/by-ssid/${encodeURIComponent(name)}`;
        const res  = await fetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'ok') {
            await Promise.all([loadSaved(), loadStatus(), scan()]);
        }
    } catch (e) {
        // ignore
    }
}

// ==================== HOTSPOT ====================

export async function startHotspot() {
    const btn = document.getElementById('btn-hotspot-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Starte…'; }
    try {
        await fetch('/api/wifi/hotspot/start', { method: 'POST' });
        await loadStatus();
    } catch (e) { /* ignore */ }
    finally {
        if (btn) { btn.disabled = false; btn.textContent = t('wifiStartHotspot'); }
    }
}

export async function stopHotspot() {
    const btn = document.getElementById('btn-hotspot-stop');
    if (btn) { btn.disabled = true; btn.textContent = 'Stoppe…'; }
    try {
        await fetch('/api/wifi/hotspot/stop', { method: 'POST' });
        await loadStatus();
    } catch (e) { /* ignore */ }
    finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Stoppen'; }
    }
}

// ==================== REINIT ====================

export async function reinitAdapter() {
    const btn = document.getElementById('btn-wifi-reinit');
    if (btn) { btn.disabled = true; btn.textContent = 'Adapter wird neu gestartet…'; }
    try {
        await fetch('/api/wifi/reinit', { method: 'POST' });
        await loadStatus();
        await scan();
    } catch (e) {
        // ignore
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '↺ Adapter neu starten'; }
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
