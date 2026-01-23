// ==================== LOCATION SEARCH ====================
// Search for places, postal codes, and coordinates using Nominatim

let searchTimeout = null;
let searchMarker = null;

// Parse coordinates from various formats
function parseCoordinates(query) {
    // Remove common characters
    const cleaned = query.trim().replace(/[°'"′″]/g, ' ').replace(/\s+/g, ' ');

    // Try decimal degrees: 52.5200, 13.4050 or 52.5200 13.4050
    const decimalPattern = /^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/;
    let match = cleaned.match(decimalPattern);
    if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            return { lat, lon };
        }
    }

    // Try DMS format: 52° 31' 12" N, 13° 24' 18" E
    const dmsPattern = /(\d+)[°\s]+(\d+)['\s]+(\d+\.?\d*)"?\s*([NS])[,\s]+(\d+)[°\s]+(\d+)['\s]+(\d+\.?\d*)"?\s*([EW])/i;
    match = cleaned.match(dmsPattern);
    if (match) {
        const latDeg = parseInt(match[1]);
        const latMin = parseInt(match[2]);
        const latSec = parseFloat(match[3]);
        const latDir = match[4].toUpperCase();
        const lonDeg = parseInt(match[5]);
        const lonMin = parseInt(match[6]);
        const lonSec = parseFloat(match[7]);
        const lonDir = match[8].toUpperCase();

        let lat = latDeg + latMin / 60 + latSec / 3600;
        let lon = lonDeg + lonMin / 60 + lonSec / 3600;

        if (latDir === 'S') lat = -lat;
        if (lonDir === 'W') lon = -lon;

        return { lat, lon };
    }

    // Try DM format: 52° 31.2' N, 13° 24.3' E
    const dmPattern = /(\d+)[°\s]+(\d+\.?\d*)'?\s*([NS])[,\s]+(\d+)[°\s]+(\d+\.?\d*)'?\s*([EW])/i;
    match = cleaned.match(dmPattern);
    if (match) {
        const latDeg = parseInt(match[1]);
        const latMin = parseFloat(match[2]);
        const latDir = match[3].toUpperCase();
        const lonDeg = parseInt(match[4]);
        const lonMin = parseFloat(match[5]);
        const lonDir = match[6].toUpperCase();

        let lat = latDeg + latMin / 60;
        let lon = lonDeg + lonMin / 60;

        if (latDir === 'S') lat = -lat;
        if (lonDir === 'W') lon = -lon;

        return { lat, lon };
    }

    return null;
}

// Perform search using Nominatim API
async function performSearch() {
    const input = document.getElementById('search-input');
    const resultsDiv = document.getElementById('search-results');
    const query = input.value.trim();

    if (!query) {
        resultsDiv.style.display = 'none';
        return;
    }

    // Check if input is coordinates
    const coords = parseCoordinates(query);
    if (coords) {
        // Direct coordinate input
        jumpToLocation(coords.lat, coords.lon, `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`);
        resultsDiv.style.display = 'none';
        input.value = '';
        return;
    }

    // Show loading
    resultsDiv.innerHTML = '<div class="search-no-results">Suche läuft...</div>';
    resultsDiv.style.display = 'block';

    try {
        // Use Nominatim for geocoding
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${encodeURIComponent(query)}&` +
            `addressdetails=1&limit=10&` +
            `countrycodes=de,at,ch,nl,be,lu,fr,dk,pl,cz`, {
            headers: {
                'User-Agent': 'BoatOS Navigation System'
            }
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const results = await response.json();

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="search-no-results">Keine Ergebnisse gefunden</div>';
            return;
        }

        // Display results
        resultsDiv.innerHTML = '';
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            const name = document.createElement('div');
            name.className = 'search-result-name';
            name.textContent = result.display_name.split(',')[0];

            const details = document.createElement('div');
            details.className = 'search-result-details';

            // Build address string
            const addressParts = [];
            if (result.address) {
                if (result.address.postcode) addressParts.push(result.address.postcode);
                if (result.address.city || result.address.town || result.address.village) {
                    addressParts.push(result.address.city || result.address.town || result.address.village);
                }
                if (result.address.country) addressParts.push(result.address.country);
            }

            details.textContent = addressParts.length > 0 ?
                addressParts.join(', ') :
                result.display_name.substring(result.display_name.indexOf(',') + 2);

            item.appendChild(name);
            item.appendChild(details);

            item.onclick = () => {
                jumpToLocation(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
                resultsDiv.style.display = 'none';
                input.value = '';
            };

            resultsDiv.appendChild(item);
        });

    } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = '<div class="search-no-results">Fehler bei der Suche</div>';
    }
}

// Jump to location on map (MapLibre version)
function jumpToLocation(lat, lon, name) {
    if (typeof map === 'undefined' || !map) {
        console.error('Map not initialized');
        return;
    }

    // Remove previous search marker if exists
    if (searchMarker) {
        searchMarker.remove();
    }

    // Create HTML element for marker
    const el = document.createElement('div');
    el.className = 'search-marker';
    el.innerHTML = '📍';
    el.style.fontSize = '24px';
    el.style.cursor = 'pointer';

    // Create MapLibre marker
    searchMarker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(new maplibregl.Popup().setHTML(`<b>🔍 Suchergebnis</b><br>${name}`))
        .addTo(map);

    searchMarker.togglePopup();

    // Fly to location
    map.flyTo({
        center: [lon, lat],
        zoom: 14,
        duration: 1500
    });

    console.log(`📍 Jumped to: ${name} (${lat.toFixed(6)}, ${lon.toFixed(6)})`);
}

// Live search with debounce
function setupSearchInput() {
    const input = document.getElementById('search-input');
    const resultsDiv = document.getElementById('search-results');

    if (!input) return;

    // Search on Enter key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        } else if (e.key === 'Escape') {
            resultsDiv.style.display = 'none';
            input.blur();
        }
    });

    // Live search with debounce
    input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = input.value.trim();
            if (query.length >= 3) {
                performSearch();
            } else {
                resultsDiv.style.display = 'none';
            }
        }, 500);
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!document.getElementById('search-container').contains(e.target)) {
            resultsDiv.style.display = 'none';
        }
    });
}

// Initialize on page load
window.addEventListener('load', setupSearchInput);
