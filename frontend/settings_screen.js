/**
 * Settings Screen Module
 * Manages the settings screen as a full-screen view (not a modal)
 */

// Track which view to return to when closing settings
let returnToView = 'dashboard'; // 'dashboard' or 'map'

// ==================== Settings Screen Management ====================

function isSettingsVisible() {
    const settingsScreen = document.getElementById('settings-modal');
    // Check both display style AND show class
    return settingsScreen && (settingsScreen.classList.contains('show') || settingsScreen.style.display === 'flex');
}

function showSettingsScreen(fromView = 'dashboard') {
    // Remember where we came from
    returnToView = fromView;

    // Hide header, map-container, and controls for fullscreen settings
    const header = document.getElementById('header');
    const mapContainer = document.getElementById('map-container');
    const controls = document.getElementById('controls');
    const dashboard = document.getElementById('sensors-dashboard');

    if (header) header.style.display = 'none';
    if (mapContainer) mapContainer.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (dashboard) dashboard.style.display = 'none';

    // Show settings screen (it's still the settings-modal element)
    const settingsScreen = document.getElementById('settings-modal');
    if (settingsScreen) {
        settingsScreen.classList.add('show');
        settingsScreen.style.display = 'flex';
    }

    // Load settings into form (from settings.js)
    if (typeof loadSettingsToForm === 'function') {
        loadSettingsToForm();
    }

    // Update FAB
    if (typeof updateFloatingActionButton === 'function') {
        updateFloatingActionButton();
    }

    console.log('⚙️ Settings screen shown (from:', fromView + ')');
}

function hideSettingsScreen() {
    const settingsScreen = document.getElementById('settings-modal');
    if (settingsScreen) {
        settingsScreen.classList.remove('show');
        settingsScreen.style.display = 'none';
    }

    // Return to the view we came from
    if (returnToView === 'dashboard') {
        // Show dashboard
        if (typeof window.SensorsDashboard !== 'undefined' && typeof window.SensorsDashboard.show === 'function') {
            window.SensorsDashboard.show();
        }
    } else if (returnToView === 'map') {
        // Show map
        const header = document.getElementById('header');
        const mapContainer = document.getElementById('map-container');
        const controls = document.getElementById('controls');

        if (header) header.style.display = 'flex';
        if (mapContainer) mapContainer.style.display = 'block';
        if (controls) controls.style.display = 'flex';

        // Recalculate map size
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (window.map && typeof window.map.invalidateSize === 'function') {
                    window.map.invalidateSize({animate: false, pan: false});
                    console.log('📏 Map size recalculated after settings closed');
                }
            });
        });
    }

    // Update FAB
    if (typeof updateFloatingActionButton === 'function') {
        updateFloatingActionButton();
    }

    console.log('⚙️ Settings screen hidden (returning to:', returnToView + ')');
}

// ==================== Settings Button in Dashboard ====================

function addSettingsButtonToDashboard() {
    // This will be called when dashboard is rendered
    // Add a settings button to the dashboard header

    // Check if button already exists
    if (document.getElementById('dashboard-settings-btn')) {
        return;
    }

    // Find the dashboard header - it's the second direct child of sensors-dashboard
    // (first is animated-bg, second is the header with gradient background)
    const dashboard = document.getElementById('sensors-dashboard');
    if (!dashboard) {
        console.warn('⚠️ Dashboard not found');
        return;
    }

    // Get all direct children and find the header (the one with flex display and gradient)
    const dashboardChildren = Array.from(dashboard.children);
    const dashboardHeader = dashboardChildren.find(child => {
        const styles = child.getAttribute('style');
        return styles && styles.includes('linear-gradient') && styles.includes('flex');
    });

    if (!dashboardHeader) {
        console.warn('⚠️ Dashboard header not found for settings button');
        return;
    }

    // Create settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'dashboard-settings-btn';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'Einstellungen';
    settingsBtn.style.cssText = `
        background: rgba(100, 255, 218, 0.2);
        border: 2px solid #64ffda;
        color: #64ffda;
        font-size: 24px;
        width: 50px;
        height: 50px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.3s;
    `;

    settingsBtn.onmouseover = () => {
        settingsBtn.style.background = 'rgba(100, 255, 218, 0.3)';
        settingsBtn.style.transform = 'scale(1.05)';
    };

    settingsBtn.onmouseout = () => {
        settingsBtn.style.background = 'rgba(100, 255, 218, 0.2)';
        settingsBtn.style.transform = 'scale(1)';
    };

    settingsBtn.onclick = () => {
        showSettingsScreen('dashboard');
    };

    // Insert button into dashboard header's right container (the one with connection status)
    const headerButtonContainer = dashboardHeader.querySelector('div:last-child');
    if (headerButtonContainer) {
        headerButtonContainer.insertBefore(settingsBtn, headerButtonContainer.firstChild);
        console.log('✅ Settings button added to dashboard');
    } else {
        console.warn('⚠️ Header button container not found');
    }
}

// Export functions
window.SettingsScreen = {
    show: showSettingsScreen,
    hide: hideSettingsScreen,
    isVisible: isSettingsVisible,
    addButtonToDashboard: addSettingsButtonToDashboard
};
