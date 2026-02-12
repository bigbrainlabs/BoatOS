// BoatOS Remote Control - Client JavaScript

class RemoteControl {
    constructor() {
        // WebSocket
        this.ws = null;
        this.reconnectInterval = null;
        this.isConnected = false;
        this.reconnectDelay = 2000;

        // Mode
        this.currentMode = 'remote'; // 'remote' or 'helm'

        // Touch tracking
        this.isTouching = false;
        this.lastTouchTime = 0;

        // Screen dimensions (will be updated from server)
        this.screenWidth = 1920;
        this.screenHeight = 1200;

        // Orientation detection
        this.isPortrait = false;
        this.autoRotate = true; // Auto-detect orientation

        // Screenshot overlay
        this.screenshotEnabled = true;
        this.screenshotInterval = null;
        this.screenshotRefreshRate = 3000; // 3 seconds (slower to reduce load)
        this.screenshotTimeout = null; // Timeout for delayed screenshot after touch
        this.screenshotUpdateCount = 0; // Counter for multiple updates after touch

        // Screenshot zoom level
        this.zoomLevel = 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 3.0;
        this.zoomStep = 0.25;

        // Elements
        this.elements = {
            touchpad: document.getElementById('touchpad'),
            screenshotImg: document.getElementById('screenshotImg'),
            touchpadInstructions: document.getElementById('touchpadInstructions'),
            crosshair: document.getElementById('crosshair'),
            touchIndicator: document.getElementById('touchIndicator'),
            remoteMode: document.getElementById('remoteMode'),
            helmMode: document.getElementById('helmMode'),
            modeToggle: document.getElementById('modeToggle'),
            modeText: document.getElementById('modeText'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            zoomIn: document.getElementById('zoomIn'),
            zoomOut: document.getElementById('zoomOut'),
            centerMap: document.getElementById('centerMap'),
            debugInfo: document.getElementById('debugInfo'),
            debugMode: document.getElementById('debugMode'),
            debugWS: document.getElementById('debugWS'),
            debugTouch: document.getElementById('debugTouch'),
            debugLatency: document.getElementById('debugLatency'),
        };

        this.init();
    }

    init() {
        console.log('Initializing BoatOS Remote Control...');

        // Detect initial orientation
        this.detectOrientation();

        // Setup WebSocket
        this.connect();

        // Setup UI event listeners
        this.setupEventListeners();

        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.detectOrientation(), 100);
        });
        window.addEventListener('resize', () => {
            this.detectOrientation();
        });

        // Enable debug mode with triple-tap on header
        let tapCount = 0;
        document.querySelector('.header').addEventListener('click', () => {
            tapCount++;
            if (tapCount === 3) {
                this.elements.debugInfo.classList.toggle('hidden');
                tapCount = 0;
            }
            setTimeout(() => tapCount = 0, 1000);
        });

        console.log('Remote Control initialized');
    }

    // Orientation Detection
    detectOrientation() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const wasPortrait = this.isPortrait;

        // Portrait if height > width
        this.isPortrait = height > width;

        if (wasPortrait !== this.isPortrait) {
            console.log(`Orientation changed: ${this.isPortrait ? 'Portrait' : 'Landscape'}`);
            this.updateDebug('mode', `Remote (${this.isPortrait ? 'Portrait' : 'Landscape'})`);
        }
    }

    // Transform coordinates based on orientation
    transformCoordinates(x, y) {
        if (!this.autoRotate || !this.isPortrait) {
            // No transformation needed in landscape
            return { x, y };
        }

        // Rotate 90° clockwise: Portrait → Landscape
        // When tablet is in portrait and display is landscape:
        // - Touch at top of tablet (y=0) → left of display (x=0)
        // - Touch at bottom of tablet (y=1) → right of display (x=1)
        // - Touch at left of tablet (x=0) → top of display (y=0)
        // - Touch at right of tablet (x=1) → bottom of display (y=1)
        return {
            x: y,      // Tablet Y becomes Display X
            y: 1 - x   // Tablet X becomes Display Y (inverted)
        };
    }

    // WebSocket Connection
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/remote-ws`;

        console.log(`Connecting to WebSocket: ${wsUrl}`);
        this.updateStatus('connecting', 'Connecting...');

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => this.onOpen();
            this.ws.onmessage = (event) => this.onMessage(event);
            this.ws.onerror = (error) => this.onError(error);
            this.ws.onclose = () => this.onClose();

        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }

    onOpen() {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.updateStatus('connected', 'Connected');
        this.updateDebug('ws', 'Connected');

        // Clear reconnect interval
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }

        // Request initial screenshot only
        if (this.screenshotEnabled) {
            this.requestScreenshot();
        }
    }

    onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('Received:', data);

            if (data.type === 'welcome') {
                console.log('Welcome message:', data.message);
                if (data.screen) {
                    this.screenWidth = data.screen.width;
                    this.screenHeight = data.screen.height;
                    console.log(`Screen: ${this.screenWidth}x${this.screenHeight}`);
                }
            } else if (data.type === 'error') {
                console.error('Server error:', data.message);
            } else if (data.type === 'screenshot') {
                this.updateScreenshotOverlay(data.data);
            }

        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    onError(error) {
        console.error('WebSocket error:', error);
        this.updateStatus('error', 'Error');
        this.updateDebug('ws', 'Error');
    }

    onClose() {
        console.log('WebSocket closed');
        this.isConnected = false;
        this.updateStatus('disconnected', 'Disconnected');
        this.updateDebug('ws', 'Disconnected');

        // Clear any pending screenshot timeout
        if (this.screenshotTimeout) {
            clearTimeout(this.screenshotTimeout);
            this.screenshotTimeout = null;
        }

        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (this.reconnectInterval) return;

        console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
        this.reconnectInterval = setInterval(() => {
            console.log('Attempting to reconnect...');
            this.connect();
        }, this.reconnectDelay);
    }

    // Screenshot Functions
    startScreenshotUpdates() {
        // Request initial screenshot
        this.requestScreenshot();

        // Set up periodic updates
        this.screenshotInterval = setInterval(() => {
            this.requestScreenshot();
        }, this.screenshotRefreshRate);

        console.log('Screenshot updates started');
    }

    stopScreenshotUpdates() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
            console.log('Screenshot updates stopped');
        }
    }

    requestScreenshot() {
        if (!this.isConnected || !this.ws) {
            console.warn('Not connected, cannot request screenshot');
            return;
        }

        try {
            console.log('Requesting screenshot...');
            this.ws.send(JSON.stringify({
                type: 'request_screenshot'
            }));
        } catch (error) {
            console.error('Error requesting screenshot:', error);
        }
    }

    // Request multiple screenshots at intervals to capture animations
    requestMultipleScreenshots() {
        // Clear any existing timeout
        if (this.screenshotTimeout) {
            clearTimeout(this.screenshotTimeout);
            this.screenshotTimeout = null;
        }

        // Request screenshots at staggered intervals to capture animations
        // 300ms, 700ms (reduced to avoid overloading the system)
        const delays = [300, 700];

        delays.forEach(delay => {
            setTimeout(() => {
                if (this.isConnected) {
                    this.requestScreenshot();
                }
            }, delay);
        });

        console.log(`Scheduled ${delays.length} screenshot updates at intervals: ${delays.join(', ')}ms`);
    }

    updateScreenshotOverlay(base64Data) {
        console.log(`Screenshot received: ${Math.round(base64Data.length / 1024)}KB`);

        // Update screenshot img element
        const imageUrl = `data:image/png;base64,${base64Data}`;
        this.elements.screenshotImg.src = imageUrl;
        this.elements.touchpad.classList.add('has-screenshot');

        console.log('Screenshot applied to touchpad');
    }

    sendTouchEvent(action, x, y) {
        if (!this.isConnected || !this.ws) {
            console.warn('Not connected, cannot send touch event');
            return;
        }

        // No coordinate transformation needed - letterbox adjustment already provides correct display coordinates
        const event = {
            type: 'touch',
            action: action,
            x: x,
            y: y,
            timestamp: Date.now()
        };

        try {
            this.ws.send(JSON.stringify(event));
            const debugText = `${action} (${x.toFixed(2)}, ${y.toFixed(2)})`;
            this.updateDebug('touch', debugText);
        } catch (error) {
            console.error('Error sending touch event:', error);
        }
    }

    // UI Event Listeners
    setupEventListeners() {
        // Mode toggle
        this.elements.modeToggle.addEventListener('click', () => this.toggleMode());

        // Touchpad events
        this.setupTouchpadEvents();

        // Quick action buttons
        this.elements.zoomIn.addEventListener('click', () => this.simulateZoom('in'));
        this.elements.zoomOut.addEventListener('click', () => this.simulateZoom('out'));
        this.elements.centerMap.addEventListener('click', () => this.simulateCenter());

        // Prevent context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // Prevent pull-to-refresh
        document.body.addEventListener('touchmove', (e) => {
            if (e.target === this.elements.touchpad || this.elements.touchpad.contains(e.target)) {
                return; // Allow touchpad scrolling
            }
            e.preventDefault();
        }, { passive: false });
    }

    setupTouchpadEvents() {
        const touchpad = this.elements.touchpad;

        // Pointer Events (modern, supports mouse, touch, pen)
        touchpad.addEventListener('pointerdown', (e) => this.onTouchStart(e));
        touchpad.addEventListener('pointermove', (e) => this.onTouchMove(e));
        touchpad.addEventListener('pointerup', (e) => this.onTouchEnd(e));
        touchpad.addEventListener('pointercancel', (e) => this.onTouchEnd(e));
        touchpad.addEventListener('pointerleave', (e) => this.onTouchEnd(e));
    }

    onTouchStart(e) {
        e.preventDefault();

        // Get coordinates relative to the screenshot image
        const coords = this.getImageCoordinates(e.clientX, e.clientY);

        // Ignore touches outside visible screenshot area
        if (!coords.isInBounds) {
            return;
        }

        this.isTouching = true;
        this.lastTouchTime = Date.now();

        // Update UI - use screen coordinates for visual feedback
        this.updateCrosshair(e.clientX, e.clientY);
        this.updateTouchIndicator(e.clientX, e.clientY, true);
        this.elements.touchpad.classList.add('active');

        // Send touch down event with normalized image coordinates
        this.sendTouchEvent('down', coords.x, coords.y);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    onTouchMove(e) {
        if (!this.isTouching) return;

        e.preventDefault();

        // Get coordinates relative to the screenshot image
        const coords = this.getImageCoordinates(e.clientX, e.clientY);

        // If moved outside bounds, treat as touch end
        if (!coords.isInBounds) {
            this.onTouchEnd(e);
            return;
        }

        // Update UI - use screen coordinates for visual feedback
        this.updateCrosshair(e.clientX, e.clientY);
        this.updateTouchIndicator(e.clientX, e.clientY, true);

        // Send touch move event with normalized image coordinates
        this.sendTouchEvent('move', coords.x, coords.y);
    }

    onTouchEnd(e) {
        if (!this.isTouching) return;

        e.preventDefault();

        this.isTouching = false;

        // Update UI
        this.elements.crosshair.classList.remove('active');
        this.elements.touchpad.classList.remove('active');
        this.updateTouchIndicator(0, 0, false);

        // Send touch up event
        this.sendTouchEvent('up', 0, 0);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(5);
        }

        // Request multiple screenshots to capture animations
        this.requestMultipleScreenshots();
    }

    // Get touch coordinates relative to the screenshot image (0-1 normalized)
    getImageCoordinates(clientX, clientY) {
        const img = this.elements.screenshotImg;
        const imgRect = img.getBoundingClientRect();

        // Check if touch is within image bounds
        const isInBounds = (
            clientX >= imgRect.left &&
            clientX <= imgRect.right &&
            clientY >= imgRect.top &&
            clientY <= imgRect.bottom
        );

        // Calculate normalized coordinates (0-1) relative to the image
        let x = (clientX - imgRect.left) / imgRect.width;
        let y = (clientY - imgRect.top) / imgRect.height;

        // Clamp to 0-1
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        return { x, y, isInBounds };
    }

    updateCrosshair(clientX, clientY) {
        // Use fixed positioning with client coordinates
        this.elements.crosshair.style.left = `${clientX}px`;
        this.elements.crosshair.style.top = `${clientY}px`;
        this.elements.crosshair.classList.add('active');
    }

    updateTouchIndicator(clientX, clientY, active) {
        if (active) {
            // Use fixed positioning with client coordinates
            this.elements.touchIndicator.style.left = `${clientX}px`;
            this.elements.touchIndicator.style.top = `${clientY}px`;
            this.elements.touchIndicator.classList.add('active');
        } else {
            this.elements.touchIndicator.classList.remove('active');
        }
    }

    // Mode switching
    toggleMode() {
        if (this.currentMode === 'remote') {
            this.switchToHelmMode();
        } else {
            this.switchToRemoteMode();
        }
    }

    switchToRemoteMode() {
        console.log('Switching to Remote mode');
        this.currentMode = 'remote';
        this.elements.remoteMode.classList.remove('hidden');
        this.elements.helmMode.classList.add('hidden');
        this.elements.modeText.textContent = 'Remote';
        this.elements.modeToggle.querySelector('.mode-icon').textContent = '📱';
        this.updateDebug('mode', 'Remote');
    }

    switchToHelmMode() {
        console.log('Switching to Helm mode');
        this.currentMode = 'helm';
        this.elements.remoteMode.classList.add('hidden');
        this.elements.helmMode.classList.remove('hidden');
        this.elements.modeText.textContent = 'Helm';
        this.elements.modeToggle.querySelector('.mode-icon').textContent = '⚓';
        this.updateDebug('mode', 'Helm');

        // Load BoatOS in iframe if not already loaded
        const iframe = document.getElementById('helmFrame');
        if (!iframe.src || iframe.src === 'about:blank') {
            iframe.src = '/';
        }
    }

    // Quick actions - zoom the screenshot view
    simulateZoom(direction) {
        if (direction === 'in') {
            this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + this.zoomStep);
        } else {
            this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - this.zoomStep);
        }

        console.log(`Screenshot zoom: ${this.zoomLevel.toFixed(2)}x`);
        this.applyZoom();

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(15);
        }
    }

    applyZoom() {
        const img = this.elements.screenshotImg;
        if (img) {
            // Scale image width based on zoom level
            // At zoom 1.0, image fills container width
            // At zoom 2.0, image is 200% of container width (scrollable)
            img.style.width = `${this.zoomLevel * 100}%`;
            img.style.height = 'auto';
        }
    }

    simulateCenter() {
        console.log('Reset zoom');
        // Reset zoom to 1.0 and scroll to top-left
        this.zoomLevel = 1.0;
        this.applyZoom();
        this.elements.touchpad.scrollTo(0, 0);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(15);
        }
    }

    // Status updates
    updateStatus(state, text) {
        this.elements.statusIndicator.className = `status-indicator ${state}`;
        this.elements.statusText.textContent = text;
    }

    updateDebug(field, value) {
        const element = this.elements[`debug${field.charAt(0).toUpperCase() + field.slice(1)}`];
        if (element) {
            element.textContent = value;
        }
    }
}

// Initialize on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.remoteControl = new RemoteControl();
    });
} else {
    window.remoteControl = new RemoteControl();
}
