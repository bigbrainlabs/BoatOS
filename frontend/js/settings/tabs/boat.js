/**
 * Settings-Tab: Boot (Bootsdaten, Abmessungen, Tank, Symbol)
 */

export const id = 'boat';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="boat_data_section">Bootsdaten</h4>
                    <div class="setting-item">
                        <span>Name</span>
                        <input type="text" class="setting-input" id="setting-boat-name" value="Arielle" style="width: 120px;">
                    </div>
                    <div class="setting-item">
                        <span data-i18n="boat_type_label">Bootstyp</span>
                        <select class="setting-input" id="setting-boat-type" style="width: 140px;">
                            <option value="motorboat">Motorboot</option>
                            <option value="sailboat">Segelboot</option>
                            <option value="yacht">Yacht</option>
                            <option value="cabin_cruiser">Kabinenkreuzer</option>
                            <option value="houseboat">Hausboot</option>
                            <option value="other">Sonstiges</option>
                        </select>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="boat_dimensions_section">Abmessungen</h4>
                    <div class="setting-item">
                        <span data-i18n="boat_length_label">Länge (m)</span>
                        <input type="number" class="setting-input" id="setting-boat-length" value="12.5" step="0.1" min="0">
                    </div>
                    <div class="setting-item">
                        <span data-i18n="boat_beam_label">Breite (m)</span>
                        <input type="number" class="setting-input" id="setting-boat-beam" value="3.8" step="0.1" min="0">
                    </div>
                    <div class="setting-item">
                        <span data-i18n="boat_draft_label">Tiefgang (m)</span>
                        <input type="number" class="setting-input" id="setting-boat-draft" value="1.2" step="0.1" min="0">
                    </div>
                    <div class="setting-item">
                        <span data-i18n="boat_height_label">Höhe (m)</span>
                        <input type="number" class="setting-input" id="setting-boat-height" value="4.5" step="0.1" min="0">
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="boat_tank_section">Tank & Verbrauch</h4>
                    <div class="setting-item">
                        <span data-i18n="boat_fuel_cap_label">Tankinhalt (L)</span>
                        <input type="number" class="setting-input" id="setting-boat-fuel-capacity" value="200" step="1" min="0">
                    </div>
                    <div class="setting-item">
                        <span data-i18n="boat_consumption_label">Verbrauch (L/h)</span>
                        <input type="number" class="setting-input" id="setting-boat-fuel-consumption" value="8.5" step="0.1" min="0">
                    </div>
                    <div class="setting-item">
                        <span data-i18n="boat_speed_label">Reisegeschw. (km/h)</span>
                        <input type="number" class="setting-input" id="setting-boat-cruise-speed" value="15" step="0.5" min="0">
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="boat_icon_section">Boot-Symbol</h4>
                    <div class="boat-icons" id="boatIcons">
                        <div class="boat-icon-option active" data-icon="motorboat" onclick="BoatOS.ui.selectBoatIcon(this)">🚤</div>
                        <div class="boat-icon-option" data-icon="sailboat" onclick="BoatOS.ui.selectBoatIcon(this)">⛵</div>
                        <div class="boat-icon-option" data-icon="yacht" onclick="BoatOS.ui.selectBoatIcon(this)">🛥️</div>
                        <div class="boat-icon-option" data-icon="ship" onclick="BoatOS.ui.selectBoatIcon(this)">🚢</div>
                    </div>
                </div>

                <div class="setting-group" style="background: rgba(52, 152, 219, 0.1); padding: 12px; border-radius: 8px;">
                    <p style="font-size: 12px; color: var(--text-dim); margin: 0; line-height: 1.5;">
                        <strong style="color: var(--accent);">Routing-Info:</strong><br>
                        Tiefgang, Höhe und Breite werden für die Routenplanung verwendet um flache Gewässer, niedrige Brücken und enge Kanäle zu vermeiden.
                    </p>
                </div>
`;

export function init(ctx) {
    // keine tab-spezifischen Aktionen (Boot-Icon läuft über BoatOS.ui.selectBoatIcon)
}

export function load(settings) {
    if (!settings.boat) return;

    const boatName = document.getElementById('setting-boat-name');
    const boatType = document.getElementById('setting-boat-type');
    const boatLength = document.getElementById('setting-boat-length');
    const boatBeam = document.getElementById('setting-boat-beam');
    const boatDraft = document.getElementById('setting-boat-draft');
    const boatHeight = document.getElementById('setting-boat-height');
    const boatFuelCapacity = document.getElementById('setting-boat-fuel-capacity');
    const boatFuelConsumption = document.getElementById('setting-boat-fuel-consumption');
    const boatCruiseSpeed = document.getElementById('setting-boat-cruise-speed');

    if (boatName && settings.boat.name) boatName.value = settings.boat.name;
    if (boatType && settings.boat.type) boatType.value = settings.boat.type;
    if (boatLength && settings.boat.length) boatLength.value = settings.boat.length;
    if (boatBeam && settings.boat.beam) boatBeam.value = settings.boat.beam;
    if (boatDraft && settings.boat.draft) boatDraft.value = settings.boat.draft;
    if (boatHeight && settings.boat.height) boatHeight.value = settings.boat.height;
    if (boatFuelCapacity && settings.boat.fuelCapacity) boatFuelCapacity.value = settings.boat.fuelCapacity;
    if (boatFuelConsumption && settings.boat.fuelConsumption) boatFuelConsumption.value = settings.boat.fuelConsumption;
    if (boatCruiseSpeed && settings.boat.cruiseSpeed) boatCruiseSpeed.value = settings.boat.cruiseSpeed;

    if (settings.boat.icon) {
        document.querySelectorAll('.boat-icon-option').forEach(el => {
            el.classList.toggle('active', el.dataset.icon === settings.boat.icon);
        });
    }
}

export function collect(settings) {
    settings.boat = settings.boat || {};

    const boatName = document.getElementById('setting-boat-name');
    const boatType = document.getElementById('setting-boat-type');
    const boatLength = document.getElementById('setting-boat-length');
    const boatBeam = document.getElementById('setting-boat-beam');
    const boatDraft = document.getElementById('setting-boat-draft');
    const boatHeight = document.getElementById('setting-boat-height');
    const boatFuelCapacity = document.getElementById('setting-boat-fuel-capacity');
    const boatFuelConsumption = document.getElementById('setting-boat-fuel-consumption');
    const boatCruiseSpeed = document.getElementById('setting-boat-cruise-speed');

    if (boatName) settings.boat.name = boatName.value;
    if (boatType) settings.boat.type = boatType.value;
    if (boatLength) settings.boat.length = parseFloat(boatLength.value) || 0;
    if (boatBeam) settings.boat.beam = parseFloat(boatBeam.value) || 0;
    if (boatDraft) settings.boat.draft = parseFloat(boatDraft.value) || 0;
    if (boatHeight) settings.boat.height = parseFloat(boatHeight.value) || 0;
    if (boatFuelCapacity) settings.boat.fuelCapacity = parseFloat(boatFuelCapacity.value) || 0;
    if (boatFuelConsumption) settings.boat.fuelConsumption = parseFloat(boatFuelConsumption.value) || 0;
    if (boatCruiseSpeed) settings.boat.cruiseSpeed = parseFloat(boatCruiseSpeed.value) || 0;

    const activeIcon = document.querySelector('.boat-icon-option.active');
    if (activeIcon) settings.boat.icon = activeIcon.dataset.icon;
}
