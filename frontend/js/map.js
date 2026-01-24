/**
 * BoatOS Map Modul
 * MapLibre GL Karteninitialisierung und -verwaltung
 *
 * Dieses Modul enthält alle kartenbezogenen Funktionen:
 * - MapLibre GL Initialisierung
 * - Tile-Layer Management
 * - Boot-Marker
 * - Track-Layer (Fahrspur)
 * - Routen-Layer
 * - Zoom & Pan Funktionen
 * - Layer-Toggle Funktionen
 */

// ===========================================
// Imports
// ===========================================
// Hinweis: core.js muss zuerst geladen werden und stellt globale Variablen bereit
// wie API_URL, currentPosition, etc.

// ===========================================
// Map State
// ===========================================
let map = null;
let boatMarker = null;
let boatMarkerElement = null;
let currentBoatHeading = 0;
let autoFollow = true;

// Layer State
let currentBaseLayer = 'osm'; // 'osm' oder 'satellite'
let seaMarkLayerVisible = true;
let inlandLayerVisible = true;

// Track History
let trackHistory = [];
let maxTrackPoints = 500;

// Route State
let currentRouteCoordinates = null;
let currentRouteColor = '#3498db';
let routeLabelMarkers = [];
let routeArrowMarkers = [];
let routeArrows = [];

// Displayed Track (aus Logbook)
let displayedTrackMarkers = [];
let displayedTrackSourceAdded = false;

// ===========================================
// Map Initialisierung
// ===========================================

/**
 * Initialisiert die MapLibre GL Karte
 * @param {Object} options - Optionale Konfiguration
 * @returns {Object} Map-Instanz
 */
export function initMap(options = {}) {
    console.log('Karte wird initialisiert...');

    // Container pruefen
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map Container nicht gefunden!');
        return null;
    }

    const rect = mapContainer.getBoundingClientRect();
    console.log(`Container Groesse: ${rect.width}x${rect.height}`);

    // Standard-Position (Aken/Elbe)
    const defaultPosition = options.center || { lat: 51.855, lon: 12.046 };

    // MapLibre GL Map erstellen mit lokalem Vector-Tiles Style
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'germany': {
                    type: 'vector',
                    tiles: [window.location.origin + '/tiles/germany/{z}/{x}/{y}'],
                    minzoom: 0,
                    maxzoom: 14
                },
                // GeoJSON Quellen fuer dynamische Daten
                'track-history': {
                    type: 'geojson',
                    data: { type: 'LineString', coordinates: [] }
                },
                'route': {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                },
                'route-shadow': {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                },
                'completed-segments': {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                },
                'current-segment': {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                },
                'remaining-segments': {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                }
            },
            layers: [
                // Basis-Layer
                { id: 'background', type: 'background', paint: { 'background-color': '#e0e0e0' } },
                { id: 'water', type: 'fill', source: 'germany', 'source-layer': 'water', paint: { 'fill-color': '#80b0d0' } },
                { id: 'waterway', type: 'line', source: 'germany', 'source-layer': 'waterway', paint: { 'line-color': '#80b0d0', 'line-width': 2 } },
                { id: 'landcover', type: 'fill', source: 'germany', 'source-layer': 'landcover', paint: { 'fill-color': '#c0e0c0', 'fill-opacity': 0.5 } },
                { id: 'park', type: 'fill', source: 'germany', 'source-layer': 'park', paint: { 'fill-color': '#a0d0a0', 'fill-opacity': 0.5 } },
                { id: 'landuse', type: 'fill', source: 'germany', 'source-layer': 'landuse', paint: { 'fill-color': '#f0f0e0', 'fill-opacity': 0.3 } },
                { id: 'building', type: 'fill', source: 'germany', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': '#d0d0d0' } },
                { id: 'roads', type: 'line', source: 'germany', 'source-layer': 'transportation', paint: { 'line-color': '#ffffff', 'line-width': 1 } },
                { id: 'roads-major', type: 'line', source: 'germany', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], paint: { 'line-color': '#ffcc80', 'line-width': 3 } },
                { id: 'boundary', type: 'line', source: 'germany', 'source-layer': 'boundary', paint: { 'line-color': '#808080', 'line-width': 1, 'line-dasharray': [2, 2] } },

                // Routen-Layer (Schatten/Outline)
                { id: 'route-shadow-line', type: 'line', source: 'route-shadow', paint: { 'line-color': 'white', 'line-width': 8, 'line-opacity': 0.4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },

                // Abgeschlossene Segmente (verblasst)
                { id: 'completed-segments-line', type: 'line', source: 'completed-segments', paint: { 'line-color': '#666', 'line-width': 4, 'line-opacity': 0.3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },

                // Haupt-Routen-Layer
                { id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#2ecc71', 'line-width': 5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },

                // Aktuelles Segment (hervorgehoben)
                { id: 'current-segment-line', type: 'line', source: 'current-segment', paint: { 'line-color': '#ffd700', 'line-width': 6, 'line-opacity': 1.0 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },

                // Verbleibende Segmente
                { id: 'remaining-segments-line', type: 'line', source: 'remaining-segments', paint: { 'line-color': '#3498db', 'line-width': 5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },

                // Track-History Layer
                { id: 'track-line', type: 'line', source: 'track-history', paint: { 'line-color': '#4CAF50', 'line-width': 3 } }
            ]
        },
        center: [defaultPosition.lon, defaultPosition.lat],
        zoom: options.zoom || 13,
        attributionControl: false
    });

    console.log('MapLibre GL Map erstellt');

    // Fehler-Handler
    map.on('error', (e) => {
        console.error('Map Fehler:', e.error);
    });

    // Navigations-Controls hinzufuegen
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');

    // Nach vollstaendigem Laden weitere Layer hinzufuegen
    map.on('load', () => {
        console.log('Karte geladen');
        addLabelsLayer();
        addOpenSeaMapOverlays();
        initMapMarkers();
    });

    // Click-Handler (wird von Waypoint-Modul verwendet)
    map.on('click', (e) => {
        window.dispatchEvent(new CustomEvent('mapclick', {
            detail: { lngLat: e.lngLat }
        }));
    });

    // Auto-Follow deaktivieren bei manueller Interaktion
    map.on('dragstart', () => {
        autoFollow = false;
        console.log('Auto-Follow deaktiviert (Karte verschoben)');
    });

    return map;
}

/**
 * Fuegt Beschriftungs-Layer hinzu
 */
function addLabelsLayer() {
    try {
        // Glyphs-Quelle fuer Text-Labels setzen
        map.setGlyphs('https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf');

        // Stadt-Labels
        map.addLayer({
            id: 'place-city',
            type: 'symbol',
            source: 'germany',
            'source-layer': 'place',
            filter: ['==', ['get', 'class'], 'city'],
            minzoom: 5,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Bold'],
                'text-size': 16
            },
            paint: {
                'text-color': '#333',
                'text-halo-color': '#fff',
                'text-halo-width': 2
            }
        });

        // Kleinstadt-Labels
        map.addLayer({
            id: 'place-town',
            type: 'symbol',
            source: 'germany',
            'source-layer': 'place',
            filter: ['==', ['get', 'class'], 'town'],
            minzoom: 8,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 13
            },
            paint: {
                'text-color': '#444',
                'text-halo-color': '#fff',
                'text-halo-width': 1.5
            }
        });

        // Dorf-Labels
        map.addLayer({
            id: 'place-village',
            type: 'symbol',
            source: 'germany',
            'source-layer': 'place',
            filter: ['==', ['get', 'class'], 'village'],
            minzoom: 11,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11
            },
            paint: {
                'text-color': '#555',
                'text-halo-color': '#fff',
                'text-halo-width': 1
            }
        });

        // Wasserweg-Labels
        map.addLayer({
            id: 'waterway-label',
            type: 'symbol',
            source: 'germany',
            'source-layer': 'waterway',
            filter: ['has', 'name'],
            layout: {
                'symbol-placement': 'line',
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 12
            },
            paint: {
                'text-color': '#4a90d9',
                'text-halo-color': '#fff',
                'text-halo-width': 1.5
            }
        });

        console.log('Labels hinzugefuegt');
    } catch (e) {
        console.warn('Labels konnten nicht hinzugefuegt werden:', e.message);
    }
}

/**
 * Fuegt OpenSeaMap Overlays hinzu (Seezeichen, Betonnung, etc.)
 */
function addOpenSeaMapOverlays() {
    try {
        // Seezeichen-Layer (Betonnung, Leuchtfeuer, etc.)
        map.addSource('seamark', {
            type: 'raster',
            tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
            tileSize: 256
        });
        map.addLayer({
            id: 'seamark-overlay',
            type: 'raster',
            source: 'seamark',
            paint: { 'raster-opacity': 1.0 }
        });

        // Binnenschifffahrt-Layer
        map.addSource('inland', {
            type: 'raster',
            tiles: ['https://tiles.openseamap.org/inland/{z}/{x}/{y}.png'],
            tileSize: 256
        });
        map.addLayer({
            id: 'inland-overlay',
            type: 'raster',
            source: 'inland',
            paint: { 'raster-opacity': 1.0 }
        });

        console.log('OpenSeaMap Overlays hinzugefuegt');
    } catch (e) {
        console.warn('OpenSeaMap Overlays konnten nicht hinzugefuegt werden:', e);
    }
}

// ===========================================
// Boot-Marker Funktionen
// ===========================================

/**
 * Initialisiert den Boot-Marker auf der Karte
 */
function initMapMarkers() {
    // Boot-Icon aus Einstellungen laden
    const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
    const boatIconType = settings.boat?.icon || 'motorboat_small';
    const boatIconHtml = (typeof window.getBoatIcon === 'function')
        ? window.getBoatIcon(boatIconType)
        : '⛵';

    // HTML-Element fuer Boot-Marker erstellen
    const el = document.createElement('div');
    el.className = 'boat-marker';
    el.innerHTML = boatIconHtml;
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '32px';
    boatMarkerElement = el;

    // Aktuelle Position aus globalem State
    const currentPos = window.currentPosition || { lat: 51.855, lon: 12.046 };

    boatMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([currentPos.lon, currentPos.lat])
        .addTo(map);

    console.log('Boot-Marker hinzugefuegt');

    // Track-History Sichtbarkeit pruefen
    if (settings.showTrackHistory === false) {
        map.setLayoutProperty('track-line', 'visibility', 'none');
    }
}

/**
 * Erstellt den Boot-Marker
 * @param {string} iconType - Typ des Boot-Icons
 * @returns {Object} Marker-Instanz
 */
export function createBoatMarker(iconType = 'motorboat_small') {
    const boatIconHtml = (typeof window.getBoatIcon === 'function')
        ? window.getBoatIcon(iconType)
        : '⛵';

    const el = document.createElement('div');
    el.className = 'boat-marker';
    el.innerHTML = boatIconHtml;
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '32px';
    boatMarkerElement = el;

    return el;
}

/**
 * Aktualisiert die Boot-Position auf der Karte
 * @param {Object} gps - GPS-Daten {lat, lon, course, heading}
 */
export function updateBoatPosition(gps) {
    if (!gps || !gps.lat || !gps.lon) return;
    if (!map || !boatMarker) return;

    const newLat = gps.lat;
    const newLon = gps.lon;

    // Nur aktualisieren wenn Position sich geaendert hat
    const currentPos = window.currentPosition || {};
    if (newLat === currentPos.lat && newLon === currentPos.lon) {
        return;
    }

    // Globalen State aktualisieren
    window.currentPosition = { lat: newLat, lon: newLon };

    // Zur Track-History hinzufuegen
    addToTrackHistory(newLat, newLon);

    // Marker-Position aktualisieren
    boatMarker.setLngLat([newLon, newLat]);

    // Marker basierend auf Kurs rotieren
    let heading = gps.course || gps.heading || 0;
    if (heading !== undefined && heading !== 0) {
        currentBoatHeading = heading;
        if (boatMarkerElement) {
            boatMarkerElement.style.transform = `rotate(${heading}deg)`;
        }
    }

    // Karte folgt Boot wenn Auto-Follow aktiv
    if (autoFollow) {
        map.easeTo({
            center: [newLon, newLat],
            duration: 500
        });
    }

    console.log(`GPS: ${newLat.toFixed(6)}, ${newLon.toFixed(6)}`);
}

/**
 * Aktualisiert das Boot-Marker Icon
 * @param {string} iconType - Typ des Icons
 */
export function updateBoatMarkerIcon(iconType) {
    if (!boatMarker || !boatMarkerElement) {
        console.warn('Boot-Marker noch nicht initialisiert');
        return;
    }

    const boatIconHtml = (typeof window.getBoatIcon === 'function')
        ? window.getBoatIcon(iconType)
        : '⛵';

    boatMarkerElement.innerHTML = boatIconHtml;
    boatMarkerElement.style.transform = `rotate(${currentBoatHeading}deg)`;
    console.log(`Boot-Marker Icon aktualisiert: ${iconType}`);
}

// ===========================================
// Track-Layer Funktionen
// ===========================================

/**
 * Initialisiert den Track-Layer (wird automatisch bei Map-Init gemacht)
 */
export function initTrackLayer() {
    // Wird bereits in initMap() durch GeoJSON Source erstellt
    console.log('Track-Layer initialisiert');
}

/**
 * Fuegt einen Punkt zur Track-History hinzu
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 */
export function addToTrackHistory(lat, lon) {
    trackHistory.push({ lat, lon, timestamp: Date.now() });

    // Maximale Anzahl Punkte begrenzen
    if (trackHistory.length > maxTrackPoints) {
        trackHistory.shift();
    }

    // GeoJSON Source aktualisieren
    updateTrackLine();
}

/**
 * Aktualisiert die Track-Linie auf der Karte
 */
export function updateTrackLine() {
    if (!map || !map.getSource('track-history')) return;

    const coordinates = trackHistory.map(point => [point.lon, point.lat]);
    map.getSource('track-history').setData({
        type: 'LineString',
        coordinates: coordinates
    });
}

/**
 * Loescht die Track-History
 */
export function clearTrack() {
    trackHistory = [];
    if (map && map.getSource('track-history')) {
        map.getSource('track-history').setData({
            type: 'LineString',
            coordinates: []
        });
    }
    console.log('Track-Historie geloescht');
}

/**
 * Setzt die maximale Anzahl Track-Punkte
 * @param {number} max - Maximale Anzahl
 */
export function setMaxTrackPoints(max) {
    maxTrackPoints = max;
    // Ueberschuessige Punkte entfernen
    while (trackHistory.length > maxTrackPoints) {
        trackHistory.shift();
    }
    updateTrackLine();
}

/**
 * Schaltet die Track-History Sichtbarkeit um
 * @param {boolean} show - true zum Anzeigen
 */
export function toggleTrackHistory(show) {
    if (map && map.getLayer('track-line')) {
        map.setLayoutProperty('track-line', 'visibility', show ? 'visible' : 'none');
    }
}

// ===========================================
// Route-Layer Funktionen
// ===========================================

/**
 * Zeigt eine Route auf der Karte an
 * @param {Array} coordinates - Array von [lon, lat] Koordinaten
 * @param {Object} options - Optionen wie Farbe, etc.
 */
export function showRoute(coordinates, options = {}) {
    if (!map) return;

    const color = options.color || '#2ecc71';
    currentRouteColor = color;

    // Route-Koordinaten speichern (fuer XTE-Berechnung)
    currentRouteCoordinates = coordinates.map(c => ({ lat: c[1], lon: c[0] }));

    const routeFeature = {
        type: 'Feature',
        properties: { color: color },
        geometry: {
            type: 'LineString',
            coordinates: coordinates
        }
    };

    // Schatten-Layer aktualisieren
    if (map.getSource('route-shadow')) {
        map.getSource('route-shadow').setData({
            type: 'FeatureCollection',
            features: [routeFeature]
        });
    }

    // Haupt-Route aktualisieren
    if (map.getSource('route')) {
        map.getSource('route').setData({
            type: 'FeatureCollection',
            features: [routeFeature]
        });
    }

    // Routen-Farbe setzen
    if (map.getLayer('route-line')) {
        map.setPaintProperty('route-line', 'line-color', color);
    }

    console.log(`Route angezeigt mit ${coordinates.length} Punkten`);
}

/**
 * Loescht die Route von der Karte
 */
export function clearRoute() {
    if (!map) return;

    // Alle Routen-Sources leeren
    const sources = ['route', 'route-shadow', 'completed-segments', 'current-segment', 'remaining-segments'];
    sources.forEach(sourceId => {
        if (map.getSource(sourceId)) {
            map.getSource(sourceId).setData({ type: 'FeatureCollection', features: [] });
        }
    });

    // Routen-Label-Marker entfernen
    removeRouteLabels();

    // Routen-Pfeile entfernen
    clearRouteArrows();

    currentRouteCoordinates = null;

    console.log('Route geloescht');
}

/**
 * Entfernt Routen-Label-Marker
 */
export function removeRouteLabels() {
    routeLabelMarkers.forEach(marker => marker.remove());
    routeLabelMarkers = [];
}

/**
 * Loescht Routen-Richtungspfeile
 */
export function clearRouteArrows() {
    routeArrows.forEach(arrow => arrow.remove());
    routeArrows = [];
    routeArrowMarkers.forEach(m => m.remove());
    routeArrowMarkers = [];
}

/**
 * Fuegt einen Routen-Label-Marker hinzu
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 * @param {string} html - HTML-Inhalt des Labels
 */
export function addRouteLabelMarker(lat, lon, html) {
    const labelEl = document.createElement('div');
    labelEl.className = 'route-label';
    labelEl.innerHTML = html;

    const labelMarker = new maplibregl.Marker({ element: labelEl, anchor: 'center' })
        .setLngLat([lon, lat])
        .addTo(map);

    routeLabelMarkers.push(labelMarker);
    return labelMarker;
}

/**
 * Fuegt einen Routen-Richtungspfeil hinzu
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 * @param {number} bearing - Kursrichtung in Grad
 */
export function addRouteArrow(lat, lon, bearing) {
    const arrowEl = document.createElement('div');
    arrowEl.className = 'route-arrow-icon';
    arrowEl.style.cssText = `transform: rotate(${bearing}deg); font-size: 20px; text-shadow: 0 0 3px rgba(0,0,0,0.8); pointer-events: none;`;
    arrowEl.innerHTML = '⬆️';

    const arrowMarker = new maplibregl.Marker({ element: arrowEl, anchor: 'center' })
        .setLngLat([lon, lat])
        .addTo(map);

    routeArrowMarkers.push(arrowMarker);
    return arrowMarker;
}

/**
 * Aktualisiert Routen-Segment-Highlighting
 * @param {Array} completedCoords - Abgeschlossene Koordinaten
 * @param {Array} currentSegmentCoords - Aktuelles Segment
 * @param {Array} remainingCoords - Verbleibende Koordinaten
 */
export function updateRouteSegments(completedCoords, currentSegmentCoords, remainingCoords) {
    if (!map) return;

    // Abgeschlossene Segmente
    if (completedCoords && completedCoords.length > 0 && map.getSource('completed-segments')) {
        map.getSource('completed-segments').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: completedCoords }
        });
    }

    // Aktuelles Segment
    if (currentSegmentCoords && currentSegmentCoords.length > 0 && map.getSource('current-segment')) {
        map.getSource('current-segment').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: currentSegmentCoords }
        });
    }

    // Verbleibende Segmente
    if (remainingCoords && remainingCoords.length > 0 && map.getSource('remaining-segments')) {
        map.getSource('remaining-segments').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: remainingCoords }
        });
    }
}

// ===========================================
// Tile-Layer Management
// ===========================================

/**
 * Fuegt einen Tile-Layer hinzu
 * @param {string} id - Layer-ID
 * @param {string} url - Tile-URL Template
 * @param {Object} options - Layer-Optionen
 */
export function addTileLayer(id, url, options = {}) {
    if (!map) return;

    if (!map.getSource(id)) {
        map.addSource(id, {
            type: 'raster',
            tiles: [url],
            tileSize: options.tileSize || 256,
            maxzoom: options.maxzoom || 19
        });

        map.addLayer({
            id: `${id}-layer`,
            type: 'raster',
            source: id,
            paint: { 'raster-opacity': options.opacity || 1.0 }
        }, options.beforeId);
    }

    console.log(`Tile-Layer hinzugefuegt: ${id}`);
}

/**
 * Entfernt einen Tile-Layer
 * @param {string} id - Layer-ID
 */
export function removeTileLayer(id) {
    if (!map) return;

    if (map.getLayer(`${id}-layer`)) {
        map.removeLayer(`${id}-layer`);
    }
    if (map.getSource(id)) {
        map.removeSource(id);
    }

    console.log(`Tile-Layer entfernt: ${id}`);
}

/**
 * Setzt die Sichtbarkeit eines Layers
 * @param {string} layerId - Layer-ID
 * @param {boolean} visible - Sichtbarkeit
 */
export function setLayerVisibility(layerId, visible) {
    if (map && map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
}

/**
 * Setzt die Opazitaet eines Layers
 * @param {string} layerId - Layer-ID
 * @param {number} opacity - Opazitaet (0-1)
 */
export function setLayerOpacity(layerId, opacity) {
    if (map && map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
}

// ===========================================
// Zoom & Pan Funktionen
// ===========================================

/**
 * Zentriert die Karte auf das Boot
 */
export function centerOnBoat() {
    const currentPos = window.currentPosition || { lat: 51.855, lon: 12.046 };
    autoFollow = true;

    if (map) {
        map.flyTo({
            center: [currentPos.lon, currentPos.lat],
            zoom: 15,
            duration: 1000
        });
    }

    console.log('Karte auf Boot zentriert');
}

/**
 * Zoomt die Karte hinein
 */
export function zoomIn() {
    if (map) {
        map.zoomIn({ duration: 300 });
    }
}

/**
 * Zoomt die Karte heraus
 */
export function zoomOut() {
    if (map) {
        map.zoomOut({ duration: 300 });
    }
}

/**
 * Fliegt zu einer Position
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 * @param {number} zoom - Zoom-Level (optional)
 */
export function flyTo(lat, lon, zoom = 14) {
    if (map) {
        map.flyTo({
            center: [lon, lat],
            zoom: zoom,
            duration: 1500
        });
    }
}

/**
 * Passt die Karte an Bounds an
 * @param {Array} bounds - [[minLon, minLat], [maxLon, maxLat]]
 * @param {Object} options - Optionen wie padding
 */
export function fitBounds(bounds, options = {}) {
    if (map && bounds) {
        map.fitBounds(bounds, {
            padding: options.padding || 50,
            duration: options.duration || 1000
        });
    }
}

/**
 * Aktiviert/Deaktiviert Auto-Follow
 * @param {boolean} enable - true zum Aktivieren
 */
export function setAutoFollow(enable) {
    autoFollow = enable;
    console.log(`Auto-Follow: ${enable ? 'aktiviert' : 'deaktiviert'}`);
}

/**
 * Gibt zurueck ob Auto-Follow aktiv ist
 * @returns {boolean}
 */
export function isAutoFollowEnabled() {
    return autoFollow;
}

// ===========================================
// Layer-Toggle Funktionen
// ===========================================

/**
 * Wechselt zwischen Karten- und Satellitenansicht
 */
export function toggleMapView() {
    if (!map) return;

    if (currentBaseLayer === 'osm') {
        currentBaseLayer = 'satellite';

        // Satelliten-Source hinzufuegen falls nicht vorhanden
        if (!map.getSource('satellite')) {
            map.addSource('satellite', {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 19
            });
        }

        // Vektor-Layer ausblenden
        hideVectorLayers();

        // Satelliten-Layer anzeigen
        if (!map.getLayer('satellite-layer')) {
            map.addLayer({
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                paint: { 'raster-opacity': 1 }
            }, 'seamark-overlay');
        } else {
            map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }

        console.log('Satellitenansicht aktiviert');
    } else {
        currentBaseLayer = 'osm';

        // Satelliten-Layer ausblenden
        if (map.getLayer('satellite-layer')) {
            map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }

        // Vektor-Layer einblenden
        showVectorLayers();

        console.log('Kartenansicht aktiviert');
    }

    return currentBaseLayer;
}

/**
 * Blendet Vektor-Layer aus
 */
function hideVectorLayers() {
    const vectorLayers = ['background', 'water', 'waterway', 'landcover', 'park', 'landuse',
                          'building', 'roads', 'roads-major', 'boundary',
                          'place-city', 'place-town', 'place-village', 'waterway-label'];
    vectorLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none');
        }
    });
}

/**
 * Blendet Vektor-Layer ein
 */
function showVectorLayers() {
    const vectorLayers = ['background', 'water', 'waterway', 'landcover', 'park', 'landuse',
                          'building', 'roads', 'roads-major', 'boundary',
                          'place-city', 'place-town', 'place-village', 'waterway-label'];
    vectorLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
    });
}

/**
 * Schaltet OpenSeaMap Seezeichen-Layer um
 * @param {boolean} visible - Sichtbarkeit
 */
export function toggleSeamarkLayer(visible) {
    seaMarkLayerVisible = visible;
    setLayerVisibility('seamark-overlay', visible);
    console.log(`Seezeichen-Layer: ${visible ? 'sichtbar' : 'ausgeblendet'}`);
}

/**
 * Schaltet Binnenschifffahrt-Layer um
 * @param {boolean} visible - Sichtbarkeit
 */
export function toggleInlandLayer(visible) {
    inlandLayerVisible = visible;
    setLayerVisibility('inland-overlay', visible);
    console.log(`Binnenschifffahrt-Layer: ${visible ? 'sichtbar' : 'ausgeblendet'}`);
}

/**
 * Gibt die aktuelle Basisschicht zurueck
 * @returns {string} 'osm' oder 'satellite'
 */
export function getCurrentBaseLayer() {
    return currentBaseLayer;
}

// ===========================================
// Displayed Track Funktionen (aus Logbook)
// ===========================================

/**
 * Zeigt einen gespeicherten Track auf der Karte an
 * @param {Array} trackData - Array von {lat, lon, timestamp}
 */
export function showTrackOnMap(trackData) {
    if (!map) return;

    // Vorherige Track-Marker entfernen
    displayedTrackMarkers.forEach(m => m.remove());
    displayedTrackMarkers = [];

    // Koordinaten konvertieren
    const trackCoords = trackData.map(point => [point.lon, point.lat]);

    // Source hinzufuegen oder aktualisieren
    if (!displayedTrackSourceAdded && map.loaded()) {
        map.addSource('displayed-track', {
            type: 'geojson',
            data: { type: 'LineString', coordinates: trackCoords }
        });
        map.addLayer({
            id: 'displayed-track-line',
            type: 'line',
            source: 'displayed-track',
            paint: {
                'line-color': '#9b59b6',
                'line-width': 4,
                'line-opacity': 0.8
            },
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            }
        });
        displayedTrackSourceAdded = true;
    } else if (map.getSource('displayed-track')) {
        map.getSource('displayed-track').setData({ type: 'LineString', coordinates: trackCoords });
        map.setLayoutProperty('displayed-track-line', 'visibility', 'visible');
    }

    // Start-Marker hinzufuegen
    if (trackCoords.length > 0) {
        const startEl = document.createElement('div');
        startEl.style.cssText = 'background: #2ecc71; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);';
        startEl.innerHTML = '▶';

        const startMarker = new maplibregl.Marker({ element: startEl, anchor: 'center' })
            .setLngLat(trackCoords[0])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Start</b><br>${new Date(trackData[0].timestamp).toLocaleString('de-DE')}`))
            .addTo(map);
        displayedTrackMarkers.push(startMarker);
    }

    // End-Marker hinzufuegen
    if (trackCoords.length > 1) {
        const endEl = document.createElement('div');
        endEl.style.cssText = 'background: #e74c3c; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);';
        endEl.innerHTML = '⏹';

        const endMarker = new maplibregl.Marker({ element: endEl, anchor: 'center' })
            .setLngLat(trackCoords[trackCoords.length - 1])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Ende</b><br>${new Date(trackData[trackData.length - 1].timestamp).toLocaleString('de-DE')}`))
            .addTo(map);
        displayedTrackMarkers.push(endMarker);
    }

    // Karte auf Track zoomen
    if (trackCoords.length > 0) {
        const bounds = createBoundsFromPoints(trackData);
        if (bounds) {
            map.fitBounds(bounds, { padding: 50 });
        }
    }

    console.log(`Track angezeigt: ${trackData.length} Punkte`);
}

/**
 * Loescht den angezeigten Track
 */
export function clearDisplayedTrack() {
    if (map && map.getLayer('displayed-track-line')) {
        map.setLayoutProperty('displayed-track-line', 'visibility', 'none');
    }

    displayedTrackMarkers.forEach(m => m.remove());
    displayedTrackMarkers = [];

    console.log('Track-Ansicht geschlossen');
}

// ===========================================
// Hilfsfunktionen
// ===========================================

/**
 * Erstellt Bounds aus einem Array von Punkten
 * @param {Array} points - Array von {lat, lon} oder [lat, lon]
 * @returns {Array} [[minLon, minLat], [maxLon, maxLat]] oder null
 */
export function createBoundsFromPoints(points) {
    if (!points || points.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    points.forEach(p => {
        const lat = Array.isArray(p) ? p[0] : p.lat;
        const lon = Array.isArray(p) ? p[1] : p.lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
    });

    return [[minLon, minLat], [maxLon, maxLat]];
}

/**
 * Berechnet die Distanz zwischen zwei Punkten (Haversine)
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Laengengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Laengengrad Punkt 2
 * @returns {number} Distanz in Metern
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Erdradius in Metern
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Berechnet den Kurs zwischen zwei Punkten
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Laengengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Laengengrad Punkt 2
 * @returns {number} Kurs in Grad (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    lat1 = lat1 * toRad;
    lat2 = lat2 * toRad;
    const dLon = (lon2 - lon1) * toRad;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * toDeg;
    bearing = (bearing + 360) % 360;

    return bearing;
}

// ===========================================
// Getter fuer internen State
// ===========================================

/**
 * Gibt die Map-Instanz zurueck
 * @returns {Object} MapLibre GL Map Instanz
 */
export function getMap() {
    return map;
}

/**
 * Gibt die aktuellen Route-Koordinaten zurueck
 * @returns {Array} Route-Koordinaten
 */
export function getCurrentRouteCoordinates() {
    return currentRouteCoordinates;
}

/**
 * Gibt die Track-History zurueck
 * @returns {Array} Track-Punkte
 */
export function getTrackHistory() {
    return trackHistory;
}

/**
 * Gibt den aktuellen Boot-Heading zurueck
 * @returns {number} Heading in Grad
 */
export function getCurrentBoatHeading() {
    return currentBoatHeading;
}

// ===========================================
// Export State Getter
// ===========================================
export function getMapState() {
    return {
        map,
        currentBaseLayer,
        seaMarkLayerVisible,
        inlandLayerVisible,
        autoFollow,
        trackHistoryLength: trackHistory.length,
        hasRoute: currentRouteCoordinates !== null
    };
}
