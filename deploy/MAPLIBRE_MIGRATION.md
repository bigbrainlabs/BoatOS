# MapLibre GL Migration Guide

## Änderungen für Offline-Karten mit MapLibre GL

### 1. HTML Änderungen (index.html)

**Ersetze Leaflet durch MapLibre GL:**

```html
<!-- VORHER (Zeile 6-7): -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>

<!-- NACHHER: -->
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"/>
```

```html
<!-- VORHER (Zeile ~1042): -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<!-- NACHHER: -->
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
```

### 2. CSS Anpassungen

**Leaflet-spezifische CSS-Klassen entfernen/anpassen:**
- `.leaflet-control-layers` -> `.maplibregl-ctrl-group`
- `.leaflet-popup-*` -> `.maplibregl-popup-*`

**Basis Map Container CSS bleibt gleich:**
```css
#map {
    width: 100%;
    height: 100%;
}
```

### 3. JavaScript Migration (app.js)

#### 3.1 Globale Variablen anpassen

```javascript
// VORHER:
let osmLayer;
let satelliteLayer;
let seaMarkLayer;
let inlandLayer;
let trafficLayer;
let boatMarker;
let routeLayer;
let trackHistoryLayer;
let favoriteMarkers = L.layerGroup();

// NACHHER:
let map; // MapLibre GL map instance
let boatMarker; // GeoJSON source for boat position
let routeSource; // GeoJSON source for route
let trackHistorySource; // GeoJSON source for track history
let favoriteSources = {}; // Object to store favorite markers
```

#### 3.2 initMap() komplett neu

```javascript
function initMap() {
    console.log('🗺️ initMap() called - MapLibre GL');

    // MapLibre GL Map erstellen
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'osm-tiles': {
                    type: 'raster',
                    tiles: ['http://localhost/tiles/styles/basic/{z}/{x}/{y}.png'],
                    tileSize: 256
                },
                'seamark': {
                    type: 'raster',
                    tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenSeaMap'
                },
                'inland': {
                    type: 'raster',
                    tiles: ['https://tiles.openseamap.org/inland/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenSeaMap Inland'
                }
            },
            layers: [
                {
                    id: 'osm-base',
                    type: 'raster',
                    source: 'osm-tiles',
                    minzoom: 0,
                    maxzoom: 22
                },
                {
                    id: 'seamark-overlay',
                    type: 'raster',
                    source: 'seamark',
                    paint: {'raster-opacity': 0.8}
                },
                {
                    id: 'inland-overlay',
                    type: 'raster',
                    source: 'inland',
                    paint: {'raster-opacity': 0.8}
                }
            ]
        },
        center: [currentPosition.lon, currentPosition.lat],
        zoom: 13,
        attributionControl: false
    });

    // Navigation Controls
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    // Wait for map to load
    map.on('load', function() {
        console.log('✅ Map loaded');
        initMapLayers();
    });
}

function initMapLayers() {
    // Add GeoJSON sources for boat, route, track
    map.addSource('boat-position', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    map.addSource('route', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    map.addSource('track-history', {
        type: 'geojson',
        data: {
            type: 'LineString',
            coordinates: []
        }
    });

    // Add layers
    map.addLayer({
        id: 'track-history-line',
        type: 'line',
        source: 'track-history',
        paint: {
            'line-color': '#4CAF50',
            'line-width': 3,
            'line-opacity': 0.8
        }
    });

    map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
            'line-color': '#2196F3',
            'line-width': 4,
            'line-opacity': 0.9
        }
    });

    map.addLayer({
        id: 'boat-marker',
        type: 'symbol',
        source: 'boat-position',
        layout: {
            'icon-image': 'boat-icon', // Custom icon (needs to be added to map)
            'icon-size': 1.5,
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map'
        }
    });
}
```

#### 3.3 Marker Updates anpassen

```javascript
// VORHER (Leaflet):
function updateBoatMarker(lat, lon, heading) {
    if (boatMarker) {
        boatMarker.setLatLng([lat, lon]);
        boatMarker.setRotationAngle(heading);
    } else {
        boatMarker = L.marker([lat, lon], {
            icon: boatIcon,
            rotationAngle: heading
        }).addTo(map);
    }
}

// NACHHER (MapLibre GL):
function updateBoatMarker(lat, lon, heading) {
    const boatFeature = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lon, lat]
            },
            properties: {
                heading: heading
            }
        }]
    };
    map.getSource('boat-position').setData(boatFeature);
}
```

#### 3.4 Route Drawing anpassen

```javascript
// VORHER (Leaflet):
function drawRoute(coordinates) {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    routeLayer = L.polyline(coordinates, {
        color: '#2196F3',
        weight: 4
    }).addTo(map);
}

// NACHHER (MapLibre GL):
function drawRoute(coordinates) {
    // coordinates = [[lat, lon], ...] -> [[lon, lat], ...]
    const lngLatCoords = coordinates.map(c => [c[1], c[0]]);

    const routeFeature = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: lngLatCoords
            }
        }]
    };
    map.getSource('route').setData(routeFeature);
}
```

#### 3.5 Pan/Zoom anpassen

```javascript
// VORHER (Leaflet):
map.setView([lat, lon], zoom);
map.panTo([lat, lon]);

// NACHHER (MapLibre GL):
map.setCenter([lon, lat]);
map.setZoom(zoom);
map.flyTo({center: [lon, lat], zoom: zoom});
```

### 4. Wichtige Unterschiede Leaflet vs MapLibre GL

| Feature | Leaflet | MapLibre GL |
|---------|---------|-------------|
| Koordinaten | `[lat, lon]` | `[lon, lat]` |
| Marker | `L.marker()` | GeoJSON Point Feature |
| Polyline | `L.polyline()` | GeoJSON LineString |
| Layer hinzufügen | `.addTo(map)` | `map.addLayer()` + `map.addSource()` |
| Pan | `map.panTo()` | `map.flyTo()` |
| Bounds | `map.fitBounds()` | `map.fitBounds()` (gleich!) |

### 5. Deployment Schritte (NACH OSM Download)

1. **Tiles generieren:**
   ```bash
   cd /home/arielle/maps
   java -Xmx8g -jar planetiler.jar \
     --download \
     --area=europe \
     --output=tiles/europe.mbtiles
   ```

2. **TileServer starten:**
   ```bash
   sudo cp /home/arielle/deploy/tileserver.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable tileserver
   sudo systemctl start tileserver
   ```

3. **nginx konfigurieren:**
   - Inhalt von `nginx-tiles.conf` in nginx server block einfügen
   - `sudo systemctl reload nginx`

4. **Frontend deployen:**
   - Geänderte `index.html` nach `/home/arielle/BoatOS/frontend/`
   - Geänderte `app.js` nach `/home/arielle/BoatOS/frontend/`

5. **Testen:**
   - Browser Cache leeren
   - BoatOS öffnen
   - Karte sollte offline von lokalem Server laden

### 6. Rollback Plan

Falls Probleme auftreten:
```bash
# Frontend zurückrollen
cp /home/arielle/BoatOS/frontend/app.js.leaflet.backup /home/arielle/BoatOS/frontend/app.js
# Browser neu laden (Ctrl+Shift+R)
```
