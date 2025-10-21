# Instagram Reel Shot List - BoatOS
## Marine Navigation System Showcase

**Duration:** 30-60 seconds
**Format:** Vertical (9:16) - 1080x1920px
**Style:** Fast-paced, tech showcase with smooth transitions
**Music:** Upbeat electronic/tech track (e.g., "Tech House" vibes)

---

## 📱 Shot List (Timestamp Guide)

### SHOT 1: Opening Hook (0-3s)
**What:** Close-up of Raspberry Pi with BoatOS logo/screen
**How to capture:**
- Focus on the Pi screen showing the BoatOS dashboard
- Slight zoom in or hand entering frame to tap screen
**Text Overlay:** "Building the future of marine navigation"
**Transition:** Quick fade or swipe

### SHOT 2: Dashboard Overview (3-8s)
**What:** Full dashboard with multiple widgets visible
**How to capture:**
1. Open BoatOS in browser on Pi touchscreen
2. Navigate to main dashboard with various widgets (GPS, AIS, Wind, Depth)
3. Screen recording or clean screenshot
**Show:** Real-time sensor data updating
**Text Overlay:** "Open Source • Raspberry Pi • Production Ready"
**Transition:** Slide left

### SHOT 3: Visual Editor Introduction (8-13s)
**What:** Opening the visual editor and showing the palette
**How to capture:**
1. Click the FAB button to open visual editor
2. Show the widget palette on the left
3. Quick pan showing available widgets
**Text Overlay:** "Drag & Drop Dashboard Editor"
**Transition:** Zoom in to widget

### SHOT 4: Drag & Drop Magic (13-20s)
**What:** Actively dragging widgets from palette to canvas
**How to capture:**
1. Screen record: Drag 2-3 widgets from palette to canvas
2. Show widgets snapping into grid
3. Show dragging widget between rows
**Show:**
- Dragging "GPS Speed" widget
- Dragging "Wind" widget
- Dragging "Depth" widget
**Text Overlay:** "Build Your Perfect Dashboard"
**Transition:** Quick cut

### SHOT 5: Customization (20-26s)
**What:** Editing widget properties
**How to capture:**
1. Click on a widget to show property panel
2. Change unit (knots to km/h)
3. Toggle MQTT topic
4. Show changes updating in real-time
**Text Overlay:** "Fully Customizable"
**Transition:** Swipe up

### SHOT 6: Reordering & Multi-Row (26-32s)
**What:** Rearranging widgets, moving between rows
**How to capture:**
1. Drag widget to reorder within same row
2. Drag widget from one row to another
3. Show smooth animations
**Text Overlay:** "Touch Optimized • Undo/Redo Support"
**Transition:** Slide down

### SHOT 7: Navigation Map (32-38s)
**What:** Switch to navigation view with route
**How to capture:**
1. Exit visual editor
2. Navigate to map section
3. Show route planning or current position
**Show:**
- Map with current GPS position
- Planned route
- AIS targets (if available)
**Text Overlay:** "Real-time Navigation & Routing"
**Transition:** Fade through

### SHOT 8: Sensor Data (38-44s)
**What:** Sensor dashboard with live data
**How to capture:**
1. Navigate to sensor dashboard
2. Show multiple sensors updating
3. Quick pan across different sensor cards
**Show:**
- GPS coordinates updating
- Wind speed/direction
- Depth sounder
- Battery voltage
**Text Overlay:** "MQTT • SignalK • WebSocket"
**Transition:** Quick cut

### SHOT 9: Raspberry Pi Setup (44-50s)
**What:** Physical setup on boat (B-roll)
**How to capture:**
- Pi mounted in boat cabin
- Connected to touchscreen
- Wiring to sensors
- Maybe show outdoor/marine environment
**Text Overlay:** "Built for Real Boats"
**Transition:** Zoom out

### SHOT 10: Call to Action (50-60s)
**What:** GitHub logo/QR code with final screen
**How to capture:**
- BoatOS logo or dashboard
- GitHub repository URL or QR code
- Star count animation (if possible)
**Text Overlay:**
- "⭐ Star on GitHub"
- "github.com/yourusername/BoatOS"
- "Free • Open Source • MIT License"
**Transition:** Fade to black

---

## 📸 How to Capture Screenshots/Video on Raspberry Pi

### Method 1: Screen Recording (Recommended for Reel)
```bash
# Install screen recording tool
sudo apt-get install vokoscreen-ng

# Or use built-in screenshot with video
# For Wayland (Raspberry Pi OS Bookworm)
wf-recorder -f boatos_demo.mp4

# For X11
ffmpeg -f x11grab -s 1920x1080 -i :0.0 boatos_output.mp4
```

### Method 2: Screenshots
```bash
# Take screenshot of entire screen
scrot boatos_screenshot.png

# Or use GNOME screenshot tool
gnome-screenshot -f boatos_dashboard.png

# For specific window
gnome-screenshot -w -f boatos_window.png
```

### Method 3: Browser Developer Tools
1. Open BoatOS in Chromium browser
2. Press F12 for DevTools
3. Press Ctrl+Shift+P
4. Type "Screenshot" and select "Capture full size screenshot"

### Method 4: Remote Recording from PC
```bash
# SSH into Pi and start VNC, then record from your PC
# Or use OBS Studio to capture browser window via SSH tunnel
ssh -L 8000:localhost:8000 pi@192.168.2.217
```

---

## 🎬 Filming Tips

### Lighting
- Use bright, even lighting on screen
- Avoid reflections on touchscreen
- Natural light works best for B-roll

### Stability
- Use tripod or stable surface for screen recordings
- Handheld is OK for B-roll boat shots
- Keep movements smooth and deliberate

### Touch Interactions
- Move finger slowly enough to be visible
- Pause briefly after each action
- Show hover effects before clicking

### Screen Recording Settings
- **Resolution:** 1920x1080 minimum
- **Frame Rate:** 30fps or 60fps
- **Format:** MP4 (H.264 codec)
- **Audio:** Optional background music only (no system sounds)

---

## 🎵 Suggested Music Tracks (Royalty-Free)

1. **Epidemic Sound:**
   - "Navigation" by Yosef
   - "Digital Wave" by Ambre Jaune
   - "Tech & Innovation" by Gavin Luke

2. **Artlist:**
   - "Forward" by AGST
   - "Innovation" by KAI

3. **YouTube Audio Library:**
   - "Tropical Heat" by VYEN
   - "Blue Skies" by Silent Partner

---

## 📝 Text Overlay Templates

### Opening (0-3s)
```
🚤 BoatOS
The Future of Marine Navigation
```

### Feature Highlights (Throughout)
```
✅ Drag & Drop Dashboard Builder
✅ Real-time Sensor Integration
✅ Touch-Optimized Interface
✅ Offline-First Design
✅ Open Source & Free
```

### Closing (50-60s)
```
⭐ Star on GitHub
github.com/[username]/BoatOS

Built with ❤️ for Sailors
#OpenSource #RaspberryPi #BoatOS
```

---

## 📱 Video Editing Workflow

### Using CapCut (Mobile/Desktop)
1. Import all clips
2. Arrange in sequence per shot list
3. Add transitions (0.3-0.5s duration)
4. Add text overlays with animations
5. Add background music (adjust volume to -12dB)
6. Color grading: Increase saturation by 10-15%
7. Export: 1080x1920, 30fps, High quality

### Using DaVinci Resolve (Desktop)
1. Create vertical timeline (1080x1920)
2. Import clips and arrange
3. Add keyframes for zoom effects
4. Use fusion for text animations
5. Color correction: Lift shadows, boost highlights
6. Export: H.264, 30Mbps bitrate

### Using Instagram's Built-in Editor
1. Upload clips in sequence
2. Trim each to 3-8 seconds
3. Use Instagram's transitions
4. Add text stickers
5. Add trending audio track
6. Use auto-captions feature

---

## 🎯 Key Messages to Convey

1. **Professional but Open Source** - Production-ready system, not just a hobby project
2. **Easy to Customize** - Visual editor makes it accessible
3. **Real Hardware** - Running on actual Raspberry Pi on real boats
4. **Modern Tech Stack** - WebSocket, MQTT, SignalK integration
5. **Community Driven** - Open for contributions

---

## 📊 Instagram Strategy

### Hashtags (Use 20-30)
```
#BoatOS #OpenSource #RaspberryPi #MarineElectronics
#SailingTech #YachtTech #NavStation #BoatLife
#MarineNavigation #DIYBoat #Cruising #Sailing
#TechForGood #MakerProject #IoT #SmartBoat
#WebDevelopment #FastAPI #Python #JavaScript
#SignalK #NMEA2000 #MarineInstrumentation
#BoatUpgrade #Liveaboard #BlueWaterSailing
```

### Caption Template
```
🚤 Introducing BoatOS - The Open Source Marine Navigation System

We built a complete navigation system for boats using a Raspberry Pi!

🎯 Features:
• Drag & drop dashboard builder
• Real-time GPS, AIS, weather data
• Touch-optimized interface
• Offline-first design
• SignalK & MQTT integration

💻 100% Open Source & Free
⚡️ Production-ready (running on real boats!)
🌊 Built by sailors, for sailors

Want to build your own? Full guide + code on GitHub!
⭐️ Link in bio

What feature should we add next? 👇

#BoatOS #OpenSource [... more hashtags]
```

### Posting Time
- Best times: 6-9 AM, 12-2 PM, 6-9 PM (CET)
- Days: Tuesday, Wednesday, Thursday perform best
- Consider sailing community time zones (US East/West Coast, Europe, Australia)

---

## 🎥 Alternative: Quick 15-Second Version

If you want a shorter, punchier Reel:

1. **0-2s:** BoatOS logo + "Open Source Marine Navigation"
2. **2-6s:** Drag & drop widget demo (sped up 1.5x)
3. **6-10s:** Dashboard with live data + map view
4. **10-13s:** Raspberry Pi setup on boat
5. **13-15s:** GitHub CTA with URL

Fast cuts, trending audio, minimal text.

---

## 📥 File Organization

Create this folder structure for your content:
```
instagram_reel/
├── raw_footage/
│   ├── 01_dashboard.mp4
│   ├── 02_visual_editor.mp4
│   ├── 03_drag_drop.mp4
│   ├── 04_customization.mp4
│   ├── 05_navigation.mp4
│   ├── 06_sensors.mp4
│   └── 07_pi_setup.mp4
├── screenshots/
│   ├── dashboard_full.png
│   ├── editor_palette.png
│   ├── map_route.png
│   └── sensors_live.png
├── assets/
│   ├── boatos_logo.png
│   ├── github_qr.png
│   └── background_music.mp3
└── final/
    └── boatos_reel_v1.mp4
```

---

## 🚀 Next Steps

1. **Capture footage** using the shot list above
2. **Transfer files** from Pi to editing device
3. **Edit video** using suggested workflow
4. **Test on phone** before posting
5. **Post during optimal time** with caption & hashtags
6. **Engage** with comments in first hour
7. **Cross-post** to Stories, TikTok, YouTube Shorts

Good luck! This is going to be an amazing showcase of your project! 🎉
