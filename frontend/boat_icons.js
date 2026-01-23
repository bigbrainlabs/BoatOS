/**
 * Boat Icons Library
 * SVG icons for different boat types as position markers
 */

const BOAT_ICONS = {
    // Kleines Motorboot (Seitenansicht)
    motorboat_small: `
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <defs>
                <filter id="shadow-small" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                    <feOffset dx="0" dy="2" result="offsetblur"/>
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.5"/>
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="hull-small" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#34495e;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#2c3e50;stop-opacity:1" />
                </linearGradient>
            </defs>
            <!-- Hull (Rumpf) -->
            <path d="M 8 30 L 10 28 L 38 26 L 40 28 L 40 32 L 38 34 L 10 34 L 8 32 Z"
                  fill="url(#hull-small)" stroke="#1a252f" stroke-width="1.5" filter="url(#shadow-small)"/>
            <!-- Cabin (Kabine) -->
            <path d="M 18 20 L 20 18 L 32 18 L 34 20 L 34 28 L 18 28 Z"
                  fill="#5a6c7d" stroke="#34495e" stroke-width="1.5"/>
            <!-- Windshield -->
            <path d="M 20 20 L 21 19 L 31 19 L 32 20 L 32 26 L 20 26 Z"
                  fill="#64b5f6" fill-opacity="0.6" stroke="#1976d2" stroke-width="1"/>
            <!-- Windshield frame -->
            <rect x="25.5" y="19" width="1" height="7" fill="#34495e"/>
            <!-- Bow (Bug) -->
            <path d="M 38 26 L 42 28 L 42 30 L 40 32"
                  fill="#455a64" stroke="#34495e" stroke-width="1"/>
            <!-- Waterline -->
            <line x1="8" y1="32" x2="40" y2="30" stroke="#0277bd" stroke-width="1.5" opacity="0.7"/>
            <!-- Wake waves -->
            <path d="M 8 34 Q 4 36 2 38 M 8 35 Q 5 37 3 39"
                  stroke="#ffffff" stroke-width="1" fill="none" opacity="0.5"/>
        </svg>
    `,

    // Großes Motorboot (Seitenansicht)
    motorboat_large: `
        <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
            <defs>
                <filter id="shadow-large" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
                    <feOffset dx="0" dy="2" result="offsetblur"/>
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.6"/>
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="hull-large" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#2c3e50;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1a252f;stop-opacity:1" />
                </linearGradient>
            </defs>
            <!-- Hull (Rumpf) -->
            <path d="M 6 35 L 8 32 L 46 28 L 50 30 L 50 36 L 48 40 L 8 40 L 6 38 Z"
                  fill="url(#hull-large)" stroke="#0d141a" stroke-width="2" filter="url(#shadow-large)"/>
            <!-- Upper cabin (Flybridge) -->
            <path d="M 16 16 L 18 14 L 32 14 L 34 16 L 34 22 L 16 22 Z"
                  fill="#34495e" stroke="#2c3e50" stroke-width="1.5"/>
            <!-- Upper windows -->
            <rect x="19" y="16" width="5" height="4" rx="0.5"
                  fill="#64b5f6" fill-opacity="0.7" stroke="#1976d2" stroke-width="1"/>
            <rect x="26" y="16" width="5" height="4" rx="0.5"
                  fill="#64b5f6" fill-opacity="0.7" stroke="#1976d2" stroke-width="1"/>
            <!-- Main cabin -->
            <path d="M 14 22 L 16 20 L 40 20 L 42 22 L 42 34 L 14 34 Z"
                  fill="#5a6c7d" stroke="#34495e" stroke-width="1.5"/>
            <!-- Main cabin windows -->
            <rect x="18" y="24" width="6" height="5" rx="0.5"
                  fill="#90caf9" fill-opacity="0.6" stroke="#1976d2" stroke-width="0.8"/>
            <rect x="26" y="24" width="6" height="5" rx="0.5"
                  fill="#90caf9" fill-opacity="0.6" stroke="#1976d2" stroke-width="0.8"/>
            <rect x="34" y="24" width="5" height="5" rx="0.5"
                  fill="#90caf9" fill-opacity="0.6" stroke="#1976d2" stroke-width="0.8"/>
            <!-- Bow -->
            <path d="M 46 28 L 52 32 L 52 35 L 50 36"
                  fill="#455a64" stroke="#34495e" stroke-width="1.5"/>
            <!-- Waterline -->
            <line x1="6" y1="38" x2="50" y2="34" stroke="#0277bd" stroke-width="2" opacity="0.7"/>
            <!-- Navigation light -->
            <circle cx="48" cy="30" r="1.5" fill="#e74c3c" opacity="0.9"/>
            <!-- Railing -->
            <line x1="14" y1="34" x2="42" y2="32" stroke="#7f8c8d" stroke-width="1" opacity="0.8"/>
            <!-- Wake waves -->
            <path d="M 6 40 Q 2 42 0 44 M 6 41 Q 3 43 1 45 M 8 42 Q 4 44 2 46"
                  stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.6"/>
        </svg>
    `,

    // Yacht (Seitenansicht)
    yacht: `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <defs>
                <filter id="shadow-yacht" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                    <feOffset dx="0" dy="3" result="offsetblur"/>
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.6"/>
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="hull-yacht" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#ecf0f1;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#bdc3c7;stop-opacity:1" />
                </linearGradient>
            </defs>
            <!-- Hull (Rumpf) -->
            <path d="M 6 40 L 8 36 L 52 30 L 58 34 L 58 42 L 54 46 L 8 46 L 6 44 Z"
                  fill="url(#hull-yacht)" stroke="#95a5a6" stroke-width="2.5" filter="url(#shadow-yacht)"/>
            <!-- Upper deck structure -->
            <path d="M 18 20 L 20 18 L 40 18 L 42 20 L 42 28 L 18 28 Z"
                  fill="#ffffff" stroke="#bdc3c7" stroke-width="2"/>
            <!-- Bridge/Flybridge -->
            <path d="M 22 10 L 24 8 L 36 8 L 38 10 L 38 18 L 22 18 Z"
                  fill="#ecf0f1" stroke="#95a5a6" stroke-width="1.5"/>
            <!-- Bridge windows -->
            <rect x="25" y="11" width="4" height="4" rx="0.5"
                  fill="#64b5f6" fill-opacity="0.7" stroke="#1976d2" stroke-width="0.8"/>
            <rect x="30" y="11" width="4" height="4" rx="0.5"
                  fill="#64b5f6" fill-opacity="0.7" stroke="#1976d2" stroke-width="0.8"/>
            <!-- Main cabin windows -->
            <rect x="22" y="21" width="6" height="5" rx="0.5"
                  fill="#90caf9" fill-opacity="0.6" stroke="#1976d2" stroke-width="0.8"/>
            <rect x="30" y="21" width="6" height="5" rx="0.5"
                  fill="#90caf9" fill-opacity="0.6" stroke="#1976d2" stroke-width="0.8"/>
            <!-- Lower cabin -->
            <path d="M 16 28 L 18 26 L 46 26 L 48 28 L 48 38 L 16 38 Z"
                  fill="#f5f5f5" stroke="#bdc3c7" stroke-width="1.5"/>
            <!-- Lower windows -->
            <rect x="20" y="30" width="7" height="5" rx="0.5"
                  fill="#b3e5fc" fill-opacity="0.5" stroke="#0288d1" stroke-width="0.6"/>
            <rect x="29" y="30" width="7" height="5" rx="0.5"
                  fill="#b3e5fc" fill-opacity="0.5" stroke="#0288d1" stroke-width="0.6"/>
            <rect x="38" y="30" width="7" height="5" rx="0.5"
                  fill="#b3e5fc" fill-opacity="0.5" stroke="#0288d1" stroke-width="0.6"/>
            <!-- Blue stripe -->
            <path d="M 8 42 L 54 38" stroke="#3498db" stroke-width="2.5" opacity="0.8"/>
            <!-- Bow -->
            <path d="M 52 30 L 60 36 L 60 40 L 58 42"
                  fill="#d5d8dc" stroke="#95a5a6" stroke-width="2"/>
            <!-- Waterline -->
            <line x1="6" y1="44" x2="58" y2="40" stroke="#0277bd" stroke-width="2" opacity="0.7"/>
            <!-- Radar mast -->
            <line x1="30" y1="8" x2="30" y2="4" stroke="#7f8c8d" stroke-width="1.5"/>
            <circle cx="30" cy="3" r="1.5" fill="#e74c3c" opacity="0.9"/>
            <!-- Navigation light -->
            <circle cx="56" cy="34" r="1.5" fill="#4caf50" opacity="0.9"/>
            <!-- Railing -->
            <line x1="18" y1="28" x2="48" y2="26" stroke="#95a5a6" stroke-width="1" opacity="0.8"/>
            <!-- Wake waves -->
            <path d="M 6 46 Q 2 48 0 50 M 6 47 Q 3 49 1 51 M 8 48 Q 4 50 2 52"
                  stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.6"/>
        </svg>
    `,

    // Luxusyacht (Seitenansicht)
    yacht_luxury: `
        <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
            <defs>
                <filter id="shadow-luxury" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3.5"/>
                    <feOffset dx="0" dy="3" result="offsetblur"/>
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.6"/>
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="hull-luxury" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ecf0f1;stop-opacity:1" />
                </linearGradient>
                <linearGradient id="gold-accent" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#f39c12;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#f1c40f;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#f39c12;stop-opacity:1" />
                </linearGradient>
            </defs>
            <!-- Hull (Rumpf) -->
            <path d="M 4 46 L 6 42 L 60 32 L 68 36 L 68 48 L 64 52 L 6 52 L 4 50 Z"
                  fill="url(#hull-luxury)" stroke="#bdc3c7" stroke-width="3" filter="url(#shadow-luxury)"/>
            <!-- Upper flybridge -->
            <path d="M 22 6 L 24 4 L 42 4 L 44 6 L 44 14 L 22 14 Z"
                  fill="#ffffff" stroke="#d5d8dc" stroke-width="2"/>
            <!-- Flybridge windows -->
            <rect x="26" y="7" width="5" height="5" rx="0.5"
                  fill="#4fc3f7" fill-opacity="0.8" stroke="#0288d1" stroke-width="1"/>
            <rect x="33" y="7" width="5" height="5" rx="0.5"
                  fill="#4fc3f7" fill-opacity="0.8" stroke="#0288d1" stroke-width="1"/>
            <!-- Middle deck -->
            <path d="M 18 14 L 20 12 L 48 12 L 50 14 L 50 24 L 18 24 Z"
                  fill="#fafafa" stroke="#bdc3c7" stroke-width="2"/>
            <!-- Middle deck windows -->
            <rect x="22" y="16" width="7" height="6" rx="0.5"
                  fill="#81d4fa" fill-opacity="0.7" stroke="#0288d1" stroke-width="0.8"/>
            <rect x="31" y="16" width="7" height="6" rx="0.5"
                  fill="#81d4fa" fill-opacity="0.7" stroke="#0288d1" stroke-width="0.8"/>
            <rect x="40" y="16" width="7" height="6" rx="0.5"
                  fill="#81d4fa" fill-opacity="0.7" stroke="#0288d1" stroke-width="0.8"/>
            <!-- Main deck -->
            <path d="M 14 24 L 16 22 L 56 22 L 58 24 L 58 42 L 14 42 Z"
                  fill="#ffffff" stroke="#bdc3c7" stroke-width="2"/>
            <!-- Main deck windows -->
            <rect x="18" y="26" width="8" height="7" rx="0.5"
                  fill="#b3e5fc" fill-opacity="0.6" stroke="#0288d1" stroke-width="0.8"/>
            <rect x="28" y="26" width="8" height="7" rx="0.5"
                  fill="#b3e5fc" fill-opacity="0.6" stroke="#0288d1" stroke-width="0.8"/>
            <rect x="38" y="26" width="8" height="7" rx="0.5"
                  fill="#b3e5fc" fill-opacity="0.6" stroke="#0288d1" stroke-width="0.8"/>
            <rect x="48" y="26" width="7" height="7" rx="0.5"
                  fill="#b3e5fc" fill-opacity="0.6" stroke="#0288d1" stroke-width="0.8"/>
            <!-- Gold stripe -->
            <path d="M 6 48 L 64 40" stroke="url(#gold-accent)" stroke-width="3" opacity="0.9"/>
            <!-- Bow -->
            <path d="M 60 32 L 70 38 L 70 45 L 68 48"
                  fill="#f5f5f5" stroke="#bdc3c7" stroke-width="2.5"/>
            <!-- Waterline -->
            <line x1="4" y1="50" x2="68" y2="44" stroke="#0277bd" stroke-width="2.5" opacity="0.7"/>
            <!-- Radar mast -->
            <line x1="34" y1="4" x2="34" y2="0" stroke="#95a5a6" stroke-width="2"/>
            <circle cx="34" cy="0" r="2" fill="#e74c3c" opacity="0.9"/>
            <line x1="31" y1="1" x2="37" y2="1" stroke="#95a5a6" stroke-width="1.5"/>
            <!-- Navigation lights -->
            <circle cx="66" cy="38" r="2" fill="#4caf50" opacity="0.9"/>
            <circle cx="14" cy="44" r="1.5" fill="#e74c3c" opacity="0.9"/>
            <!-- Railings -->
            <line x1="18" y1="24" x2="58" y2="22" stroke="#bdc3c7" stroke-width="1" opacity="0.9"/>
            <line x1="22" y1="14" x2="50" y2="12" stroke="#d5d8dc" stroke-width="1" opacity="0.8"/>
            <!-- Bow decoration -->
            <circle cx="68" cy="38" r="2" fill="#f39c12" opacity="0.9"/>
            <!-- Wake waves -->
            <path d="M 4 52 Q 0 54 -2 56 M 4 53 Q 1 55 -1 57 M 6 54 Q 2 56 0 58"
                  stroke="#ffffff" stroke-width="2" fill="none" opacity="0.7"/>
            <!-- Hull shine -->
            <path d="M 10 28 Q 12 36 10 44" stroke="#ffffff" stroke-width="2" opacity="0.3" fill="none"/>
        </svg>
    `,

    // Segelboot
    sailboat: `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                    <feOffset dx="0" dy="2" result="offsetblur"/>
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.5"/>
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="sailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.95" />
                    <stop offset="100%" style="stop-color:#ecf0f1;stop-opacity:0.85" />
                </linearGradient>
            </defs>
            <!-- Main sail -->
            <path d="M 32 8 L 32 38 L 44 36 Z"
                  fill="url(#sailGradient)" stroke="#bdc3c7" stroke-width="1.5" filter="url(#shadow)"/>
            <!-- Jib sail -->
            <path d="M 32 12 L 32 38 L 22 34 Z"
                  fill="url(#sailGradient)" stroke="#bdc3c7" stroke-width="1.5" filter="url(#shadow)"/>
            <!-- Mast -->
            <line x1="32" y1="8" x2="32" y2="42" stroke="#8d6e63" stroke-width="2"/>
            <!-- Hull -->
            <path d="M 32 38 L 26 44 L 22 48 L 22 50 L 42 50 L 42 48 L 38 44 Z"
                  fill="#2c3e50" stroke="#1a252f" stroke-width="2" filter="url(#shadow)"/>
            <!-- Cabin -->
            <rect x="29" y="40" width="6" height="4" rx="1"
                  fill="#34495e" stroke="#2c3e50" stroke-width="1"/>
            <!-- Window -->
            <rect x="30" y="41" width="4" height="2" rx="0.3"
                  fill="#64b5f6" fill-opacity="0.6" stroke="#1976d2" stroke-width="0.5"/>
            <!-- Deck -->
            <ellipse cx="32" cy="44" rx="8" ry="2" fill="#34495e"/>
            <!-- Boom -->
            <line x1="32" y1="36" x2="42" y2="34" stroke="#8d6e63" stroke-width="1.5"/>
            <!-- Mast top -->
            <circle cx="32" cy="8" r="1.5" fill="#e74c3c" opacity="0.9"/>
            <!-- Wake -->
            <path d="M 32 50 Q 26 54 22 56 M 32 50 Q 38 54 42 56"
                  stroke="#ffffff" stroke-width="1.5" fill="none" opacity="0.5"/>
            <!-- Sail details (seams) -->
            <path d="M 32 15 L 40 32" stroke="#d5d8dc" stroke-width="0.5" opacity="0.5"/>
            <path d="M 32 23 L 42 34" stroke="#d5d8dc" stroke-width="0.5" opacity="0.5"/>
        </svg>
    `
};

/**
 * Get boat icon HTML for a given type
 * @param {string} type - Boat type (motorboat_small, motorboat_large, yacht, yacht_luxury, sailboat)
 * @returns {string} SVG HTML
 */
function getBoatIcon(type = 'motorboat_small') {
    return BOAT_ICONS[type] || BOAT_ICONS.motorboat_small;
}

/**
 * Create a Leaflet DivIcon with the selected boat icon (DEPRECATED - use MapLibre markers)
 * @param {string} type - Boat type
 * @param {number} rotation - Rotation angle in degrees (0 = North)
 * @returns {L.DivIcon|null} Leaflet icon or null if Leaflet not available
 */
function createBoatMarkerIcon(type = 'motorboat_small', rotation = 0) {
    // Skip if Leaflet not available (MapLibre migration)
    if (typeof L === 'undefined') {
        console.log('⚠️ createBoatMarkerIcon: Leaflet not available');
        return null;
    }

    const iconHtml = getBoatIcon(type);

    return L.divIcon({
        className: 'boat-marker-icon',
        html: `<div style="transform: rotate(${rotation}deg); transform-origin: center; transition: transform 0.3s ease;">${iconHtml}</div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });
}
