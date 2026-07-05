/**
 * Settings-Tab: Seekarten (installierte Karten, ELWIS ENC Download, Upload)
 *
 * Die Chart-Funktionen (loadENCCatalog, downloadSelectedENC, uploadChart,
 * updateFileInfo, loadChartsList ...) sind globale Funktionen aus charts.js.
 */

export const id = 'charts';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="settings_installed_charts">Installierte Seekarten</h4>
                    <div id="charts-list" style="max-height: 250px; overflow-y: auto; background: rgba(42, 82, 152, 0.1); padding: 15px; border-radius: 8px;">
                        <div style="color: #8892b0; text-align: center; padding: 20px;" data-i18n="settings_no_charts">Keine Karten installiert</div>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="elwis_enc_download">ELWIS ENC herunterladen</h4>
                    <p style="font-size: 12px; color: #8892b0; margin-bottom: 10px;">Offizielle Binnenschifffahrtskarten von ELWIS</p>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                        <button onclick="loadENCCatalog()" class="btn-secondary" data-i18n="load_catalog" style="flex: 1; min-width: 100px;">Katalog laden</button>
                        <button onclick="selectAllENC()" class="btn-secondary" data-i18n="select_all" style="flex: 0;">Alle</button>
                        <button onclick="deselectAllENC()" class="btn-secondary" data-i18n="select_none" style="flex: 0;">Keine</button>
                    </div>
                    <div id="enc-catalog-list" style="max-height: 300px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="color: #8892b0; text-align: center; padding: 20px;">Klicke "Katalog laden" um verfügbare ENC anzuzeigen</div>
                    </div>
                    <button onclick="downloadSelectedENC()" id="download-enc-btn" disabled class="btn-primary" data-i18n="download_selected" style="width: 100%;">Ausgewählte herunterladen</button>
                    <div id="enc-download-status" style="margin-top: 10px; font-size: 12px; color: #64ffda; text-align: center;"></div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="upload_chart">Karte hochladen</h4>
                    <p style="font-size: 12px; color: #8892b0; margin-bottom: 10px;">KAP, ENC (.000), ZIP, MBTiles, GeoTIFF</p>
                    <input type="file" id="chart-file-input" accept=".kap,.zip,.mbtiles,.tif,.tiff,.000" multiple style="display: none;" onchange="updateFileInfo()">
                    <input type="file" id="chart-folder-input" accept=".kap,.zip,.mbtiles,.tif,.tiff,.000" webkitdirectory directory multiple style="display: none;" onchange="updateFileInfo()">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button onclick="document.getElementById('chart-file-input').click()" class="btn-secondary" data-i18n="settings_chart_files_btn" style="flex: 1;">Dateien</button>
                        <button onclick="document.getElementById('chart-folder-input').click()" class="btn-secondary" data-i18n="settings_chart_folder_btn" style="flex: 1;">Ordner</button>
                    </div>
                    <div id="selected-files-info" style="font-size: 12px; color: #64ffda; margin-bottom: 10px; min-height: 18px;"></div>
                    <input type="text" id="chart-name-input" data-i18n-placeholder="chart_name_optional" placeholder="Karten-Name (optional)" class="setting-input" style="width: 100%; margin-bottom: 10px;">
                    <button onclick="uploadChart()" class="btn-primary" data-i18n="settings_chart_upload_btn" style="width: 100%;">Hochladen</button>
                </div>
`;

export function init(ctx) {
    // Chart-Funktionen sind global (charts.js), Handler bleiben inline
}

export function load(settings) {
    // keine Settings-Felder in diesem Tab
}

export function collect(settings) {
    // keine Settings-Felder in diesem Tab
}

export function onShow(ctx) {
    // Installierte Karten laden (charts.js lief beim App-Start, als #charts-list noch nicht existierte)
    if (typeof window.loadCharts === 'function') window.loadCharts();
}
