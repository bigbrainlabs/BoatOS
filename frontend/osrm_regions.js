/**
 * OSRM Region Management
 * Handles switching between different OSRM routing regions
 */

/**
 * Load available OSRM regions from backend
 */
async function loadAvailableRegions() {
    const API_URL = window.location.origin;
    try {
        const response = await fetch(`${API_URL}/api/routing/regions`);

        if (!response.ok) {
            console.error('Failed to load regions:', response.status);
            return;
        }

        const data = await response.json();
        const regions = data.regions || [];

        console.log('📍 Available OSRM regions:', regions);

        // Populate dropdown
        const selector = document.getElementById('region-selector');
        if (selector) {
            selector.innerHTML = '';

            regions.forEach(region => {
                const option = document.createElement('option');
                option.value = region.id;
                option.textContent = region.name;
                selector.appendChild(option);
            });

            console.log(`✅ Loaded ${regions.length} regions into dropdown`);
        }

    } catch (error) {
        console.error('Error loading regions:', error);
        const selector = document.getElementById('region-selector');
        if (selector) {
            selector.innerHTML = '<option value="">Fehler beim Laden</option>';
        }
    }
}

/**
 * Load current active OSRM region from backend
 */
async function loadCurrentRegion() {
    const API_URL = window.location.origin;
    try {
        const response = await fetch(`${API_URL}/api/routing/current-region`);

        if (!response.ok) {
            console.error('Failed to load current region:', response.status);
            return;
        }

        const data = await response.json();

        console.log('🗺️ Current OSRM region:', data);

        // Update display
        const displayEl = document.getElementById('current-region-name');
        const statusEl = document.getElementById('region-status');

        if (displayEl) {
            if (data.running && data.region) {
                // Map region ID to display name
                const displayNames = {
                    "baden-wuerttemberg": "Baden-Württemberg",
                    "bayern": "Bayern",
                    "berlin": "Berlin",
                    "brandenburg": "Brandenburg",
                    "bremen": "Bremen",
                    "hamburg": "Hamburg",
                    "hessen": "Hessen",
                    "mecklenburg-vorpommern": "Mecklenburg-Vorpommern",
                    "niedersachsen": "Niedersachsen",
                    "nordrhein-westfalen": "Nordrhein-Westfalen",
                    "rheinland-pfalz": "Rheinland-Pfalz",
                    "saarland": "Saarland",
                    "sachsen": "Sachsen",
                    "sachsen-anhalt": "Sachsen-Anhalt",
                    "schleswig-holstein": "Schleswig-Holstein",
                    "thueringen": "Thüringen",
                    "germany": "Deutschland (komplett)",
                    "elbe": "Elbe (Sachsen-Anhalt + Brandenburg + Sachsen)"
                };

                const displayName = displayNames[data.region] || data.region.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                displayEl.textContent = displayName;

                if (statusEl) {
                    statusEl.textContent = '(aktiv)';
                    statusEl.style.color = '#2ecc71';
                }
            } else {
                displayEl.textContent = 'Nicht verfügbar';
                if (statusEl) {
                    statusEl.textContent = '(offline)';
                    statusEl.style.color = '#e74c3c';
                }
            }
        }

        // Select current region in dropdown
        const selector = document.getElementById('region-selector');
        if (selector && data.region) {
            selector.value = data.region;
        }

    } catch (error) {
        console.error('Error loading current region:', error);
        const displayEl = document.getElementById('current-region-name');
        if (displayEl) {
            displayEl.textContent = 'Fehler beim Laden';
        }
    }
}

/**
 * Switch to a new OSRM region
 */
async function switchOSRMRegion() {
    const API_URL = window.location.origin;
    const selector = document.getElementById('region-selector');
    const statusDiv = document.getElementById('region-switch-status');
    const switchBtn = document.getElementById('switch-region-btn');

    if (!selector || !selector.value) {
        showRegionStatus('⚠️ Bitte wähle eine Region aus', 'warning');
        return;
    }

    const selectedRegion = selector.value;
    const selectedText = selector.options[selector.selectedIndex].text;

    // Confirm switch
    if (!confirm(`OSRM-Region wechseln zu "${selectedText}"?\n\nDer OSRM-Server wird neu gestartet (dauert ca. 2-3 Sekunden).`)) {
        return;
    }

    // Show loading state
    showRegionStatus('🔄 Wechsle Region...', 'loading');
    if (switchBtn) {
        switchBtn.disabled = true;
        switchBtn.textContent = '⏳ Wechsle...';
    }

    try {
        const response = await fetch(`${API_URL}/api/routing/switch-region`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                region: selectedRegion
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }

        const result = await response.json();

        if (result.success) {
            showRegionStatus(`✅ Region gewechselt zu "${selectedText}"!`, 'success');

            // Reload current region display after a short delay
            setTimeout(() => {
                loadCurrentRegion();
            }, 1000);

            console.log(`✅ OSRM region switched to: ${selectedRegion}`);
        } else {
            throw new Error(result.error || 'Unbekannter Fehler');
        }

    } catch (error) {
        console.error('Error switching region:', error);
        showRegionStatus(`❌ Fehler: ${error.message}`, 'error');
    } finally {
        // Re-enable button
        if (switchBtn) {
            switchBtn.disabled = false;
            switchBtn.textContent = '🔄 Region wechseln';
        }
    }
}

/**
 * Show status message for region switching
 */
function showRegionStatus(message, type = 'info') {
    const statusDiv = document.getElementById('region-switch-status');
    if (!statusDiv) return;

    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    // Set color based on type
    const colors = {
        'success': 'rgba(46, 204, 113, 0.2)',
        'error': 'rgba(231, 76, 60, 0.2)',
        'warning': 'rgba(241, 196, 15, 0.2)',
        'loading': 'rgba(52, 152, 219, 0.2)',
        'info': 'rgba(142, 68, 173, 0.2)'
    };

    const textColors = {
        'success': '#2ecc71',
        'error': '#e74c3c',
        'warning': '#f1c40f',
        'loading': '#3498db',
        'info': '#8e44ad'
    };

    statusDiv.style.background = colors[type] || colors.info;
    statusDiv.style.color = textColors[type] || textColors.info;
    statusDiv.style.border = `1px solid ${textColors[type] || textColors.info}`;

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

/**
 * Initialize region switcher when settings tab is opened
 */
function initOSRMRegionSwitcher() {
    // Load available regions
    loadAvailableRegions();

    // Load current region
    loadCurrentRegion();

    console.log('🗺️ OSRM region switcher initialized');
}

// Auto-initialize when routing tab is opened
const originalSwitchSettingsTab = window.switchSettingsTab;
if (typeof originalSwitchSettingsTab === 'function') {
    window.switchSettingsTab = function(tabName) {
        // Call original function
        originalSwitchSettingsTab(tabName);

        // If routing tab, initialize region switcher
        if (tabName === 'routing') {
            setTimeout(() => {
                initOSRMRegionSwitcher();
            }, 100);
        }
    };
}

// Also initialize on page load if routing tab is already active
window.addEventListener('load', function() {
    const routingTab = document.getElementById('settings-routing');
    if (routingTab && routingTab.classList.contains('active')) {
        initOSRMRegionSwitcher();
    }
});

console.log('📍 OSRM region management module loaded');
