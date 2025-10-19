"""
AIS Service - Fetch vessel positions from multiple providers
Supports: AISHub, AISStream (WebSocket)
"""
import asyncio
import aiohttp
import websockets
import json
import time
from typing import Dict, List, Optional

class AISService:
    def __init__(self):
        self.provider = 'aisstream'  # 'aishub', 'aisstream'
        self.api_key = None
        self.last_fetch = 0
        self.min_interval = 60  # Rate limit varies by provider
        self.vessels = {}  # Cache: MMSI -> vessel data
        self.enabled = False  # Disabled by default - requires API key
        self.ws_connection = None
        self.ws_task = None
        self.ws_running = False
        self.bounding_box = None  # Current map bounding box

    def configure(self, provider: str = "aishub", api_key: str = "", enabled: bool = None):
        """Configure AIS service with provider, API key, and enabled flag"""
        old_provider = self.provider
        self.provider = provider.lower()
        self.api_key = api_key

        # Use explicit enabled flag if provided, otherwise check for API key
        if enabled is not None:
            self.enabled = enabled
        else:
            self.enabled = bool(api_key and len(api_key) > 0)

        print(f"🚢 AIS Service: {self.provider} {'enabled' if self.enabled else 'disabled'}")

        # Restart WebSocket if provider changed to/from AISStream
        if old_provider != self.provider:
            if self.provider == 'aisstream' and self.enabled:
                asyncio.create_task(self.start_aisstream_websocket())
            else:
                asyncio.create_task(self.stop_aisstream_websocket())

    async def fetch_vessels(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float) -> List[Dict]:
        """
        Fetch vessels in bounding box from configured provider

        Args:
            lat_min, lon_min: Southwest corner
            lat_max, lon_max: Northeast corner

        Returns:
            List of vessel dictionaries
        """
        if not self.enabled:
            return []

        if self.provider == 'aishub':
            return await self._fetch_aishub(lat_min, lon_min, lat_max, lon_max)
        elif self.provider == 'aisstream':
            return await self._fetch_aisstream(lat_min, lon_min, lat_max, lon_max)
        else:
            return []

    async def _fetch_aishub(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float) -> List[Dict]:
        """Fetch from AISHub API"""
        if not self.api_key:
            return []

        # Rate limiting
        now = time.time()
        if now - self.last_fetch < self.min_interval:
            # Return cached data if too soon
            return list(self.vessels.values())

        try:
            # AISHub API endpoint
            url = "http://data.aishub.net/ws.php"
            params = {
                'username': self.api_key,
                'format': '1',  # JSON format
                'output': 'json',
                'compress': '0',
                'latmin': lat_min,
                'latmax': lat_max,
                'lonmin': lon_min,
                'lonmax': lon_max
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.last_fetch = now

                        # Parse AISHub response
                        vessels = []
                        if isinstance(data, list):
                            # Format 1 returns array of arrays
                            for entry in data:
                                if isinstance(entry, dict) and 'MMSI' in entry:
                                    vessel = self._parse_vessel(entry)
                                    if vessel:
                                        vessels.append(vessel)
                                        self.vessels[vessel['mmsi']] = vessel
                        elif isinstance(data, dict) and 'DATA' in data:
                            # Alternative format
                            for entry in data.get('DATA', []):
                                vessel = self._parse_vessel(entry)
                                if vessel:
                                    vessels.append(vessel)
                                    self.vessels[vessel['mmsi']] = vessel

                        print(f"🚢 AIS: Fetched {len(vessels)} vessels")
                        return vessels
                    else:
                        print(f"⚠️ AIS API error: HTTP {response.status}")
                        return list(self.vessels.values())  # Return cached

        except asyncio.TimeoutError:
            print("⚠️ AIS API timeout")
            return list(self.vessels.values())
        except Exception as e:
            print(f"⚠️ AIS API error: {e}")
            return list(self.vessels.values())

    def _parse_vessel(self, data: Dict) -> Optional[Dict]:
        """Parse AISHub vessel data to standard format"""
        try:
            # AISHub field mapping (may vary by format)
            mmsi = data.get('MMSI') or data.get('mmsi')
            lat = data.get('LATITUDE') or data.get('lat')
            lon = data.get('LONGITUDE') or data.get('lon')

            if not all([mmsi, lat, lon]):
                return None

            return {
                'mmsi': str(mmsi),
                'name': data.get('NAME') or data.get('name') or f"Vessel {mmsi}",
                'lat': float(lat),
                'lon': float(lon),
                'cog': float(data.get('COG') or data.get('cog') or 0),  # Course over ground
                'sog': float(data.get('SOG') or data.get('sog') or 0),  # Speed over ground (knots)
                'heading': int(data.get('HEADING') or data.get('heading') or 0),
                'navstat': int(data.get('NAVSTAT') or data.get('navstat') or 0),  # Navigation status
                'type': int(data.get('TYPE') or data.get('type') or 0),  # Ship type
                'timestamp': int(data.get('TIME') or data.get('time') or time.time()),
                'destination': data.get('DESTINATION') or data.get('destination') or '',
                'eta': data.get('ETA') or data.get('eta') or '',
                'length': int(data.get('A', 0)) + int(data.get('B', 0)),
                'width': int(data.get('C', 0)) + int(data.get('D', 0)),
                'draught': float(data.get('DRAUGHT') or data.get('draught') or 0) / 10.0,  # meters
                'callsign': data.get('CALLSIGN') or data.get('callsign') or '',
                'imo': data.get('IMO') or data.get('imo') or ''
            }
        except (ValueError, TypeError) as e:
            print(f"⚠️ Error parsing vessel data: {e}")
            return None

    def get_navstat_text(self, navstat: int) -> str:
        """Get navigation status text"""
        statuses = {
            0: "Under way using engine",
            1: "At anchor",
            2: "Not under command",
            3: "Restricted manoeuvrability",
            4: "Constrained by draught",
            5: "Moored",
            6: "Aground",
            7: "Engaged in fishing",
            8: "Under way sailing",
            9: "Reserved",
            10: "Reserved",
            11: "Power-driven towing astern",
            12: "Power-driven pushing/towing",
            13: "Reserved",
            14: "AIS-SART active",
            15: "Undefined"
        }
        return statuses.get(navstat, "Unknown")

    def get_ship_type_text(self, ship_type: int) -> str:
        """Get ship type text"""
        if ship_type == 0:
            return "Unknown"
        elif 1 <= ship_type <= 19:
            return "Reserved"
        elif 20 <= ship_type <= 29:
            return "Wing in ground"
        elif ship_type == 30:
            return "Fishing"
        elif ship_type == 31:
            return "Towing"
        elif ship_type == 32:
            return "Towing (large)"
        elif ship_type == 33:
            return "Dredging"
        elif ship_type == 34:
            return "Diving ops"
        elif ship_type == 35:
            return "Military ops"
        elif ship_type == 36:
            return "Sailing"
        elif ship_type == 37:
            return "Pleasure craft"
        elif 40 <= ship_type <= 49:
            return "High speed craft"
        elif ship_type == 50:
            return "Pilot vessel"
        elif ship_type == 51:
            return "Search and rescue"
        elif ship_type == 52:
            return "Tug"
        elif ship_type == 53:
            return "Port tender"
        elif ship_type == 54:
            return "Anti-pollution"
        elif ship_type == 55:
            return "Law enforcement"
        elif 60 <= ship_type <= 69:
            return "Passenger"
        elif 70 <= ship_type <= 79:
            return "Cargo"
        elif 80 <= ship_type <= 89:
            return "Tanker"
        elif 90 <= ship_type <= 99:
            return "Other"
        else:
            return "Unknown"

    async def _fetch_aisstream(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float) -> List[Dict]:
        """
        Fetch from AISStream.io WebSocket cache
        WebSocket runs in background, this filters the cache
        """
        # Update bounding box for WebSocket filtering
        self.bounding_box = {
            'lat_min': lat_min,
            'lon_min': lon_min,
            'lat_max': lat_max,
            'lon_max': lon_max
        }

        # Start WebSocket if not running
        if not self.ws_running:
            asyncio.create_task(self.start_aisstream_websocket())

        # Filter vessels in bounding box from cache
        vessels_in_bounds = []
        for mmsi, vessel in list(self.vessels.items()):
            if (lat_min <= vessel['lat'] <= lat_max and
                lon_min <= vessel['lon'] <= lon_max):
                vessels_in_bounds.append(vessel)

        return vessels_in_bounds

    async def start_aisstream_websocket(self):
        """Start AISStream WebSocket connection in background"""
        if self.ws_running:
            return

        self.ws_running = True
        print("🚢 Starting AISStream WebSocket...")

        while self.ws_running and self.provider == 'aisstream':
            try:
                async with websockets.connect('wss://stream.aisstream.io/v0/stream') as websocket:
                    self.ws_connection = websocket

                    # Subscribe to AIS messages (Europe only to reduce load)
                    subscribe_message = {
                        "APIKey": self.api_key,
                        "BoundingBoxes": [[[-25, 35], [45, 72]]]  # Europe (Atlantic to Black Sea, Mediterranean to North Cape)
                    }
                    await websocket.send(json.dumps(subscribe_message))
                    print("✅ AISStream WebSocket connected")

                    # Receive messages
                    while self.ws_running:
                        try:
                            message = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                            data = json.loads(message)
                            self._process_aisstream_message(data)
                        except asyncio.TimeoutError:
                            # Send ping to keep connection alive
                            await websocket.ping()
                        except websockets.exceptions.ConnectionClosed:
                            print(f"⚠️ AISStream connection closed, reconnecting...")
                            break
                        except Exception as e:
                            # Log but don't break on parsing errors
                            print(f"⚠️ AISStream message error: {e}")
                            continue

            except Exception as e:
                print(f"⚠️ AISStream WebSocket error: {e}")

            # Always wait before reconnect attempt (whether error or connection closed)
            if self.ws_running:
                await asyncio.sleep(10)  # Prevent busy loop on reconnect

        print("🚢 AISStream WebSocket stopped")
        self.ws_running = False

    async def stop_aisstream_websocket(self):
        """Stop AISStream WebSocket connection"""
        self.ws_running = False
        if self.ws_connection:
            await self.ws_connection.close()
            self.ws_connection = None

    def _process_aisstream_message(self, data: Dict):
        """Process incoming AISStream message and update cache"""
        try:
            # AISStream format: {"MessageType": "PositionReport", "Message": {...}}
            if data.get('MessageType') != 'PositionReport':
                return

            msg = data.get('Message', {}).get('PositionReport', {})
            if not msg:
                return

            mmsi = str(msg.get('UserID'))
            lat = msg.get('Latitude')
            lon = msg.get('Longitude')

            if not all([mmsi, lat, lon]):
                return

            # Log first few vessels
            if len(self.vessels) < 5:
                print(f"📍 AIS vessel: {mmsi} at ({lat:.4f}, {lon:.4f})")

            # Update cache
            self.vessels[mmsi] = {
                'mmsi': mmsi,
                'name': data.get('MetaData', {}).get('ShipName', f"Vessel {mmsi}"),
                'lat': float(lat),
                'lon': float(lon),
                'cog': float(msg.get('Cog', 0)),
                'sog': float(msg.get('Sog', 0) / 10.0),  # AISStream sends in 0.1 knots
                'heading': int(msg.get('TrueHeading', 0)),
                'navstat': int(msg.get('NavigationalStatus', 0)),
                'type': int(data.get('MetaData', {}).get('ShipType', 0)),
                'timestamp': int(time.time()),
                'destination': data.get('MetaData', {}).get('Destination', ''),
                'eta': '',
                'length': int(data.get('MetaData', {}).get('Dimension', {}).get('A', 0)) +
                         int(data.get('MetaData', {}).get('Dimension', {}).get('B', 0)),
                'width': int(data.get('MetaData', {}).get('Dimension', {}).get('C', 0)) +
                        int(data.get('MetaData', {}).get('Dimension', {}).get('D', 0)),
                'draught': float(msg.get('Draught', 0) / 10.0),
                'callsign': data.get('MetaData', {}).get('CallSign', ''),
                'imo': ''
            }

            # Clean old vessels (older than 10 minutes)
            current_time = time.time()
            self.vessels = {
                mmsi: v for mmsi, v in self.vessels.items()
                if current_time - v['timestamp'] < 600
            }

        except Exception as e:
            print(f"⚠️ Error processing AISStream message: {e}")

# Global AIS service instance
ais_service = AISService()
