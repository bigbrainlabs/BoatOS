#!/usr/bin/env python3
"""
Virtual Input Handler für BoatOS Remote Control
Erstellt ein virtuelles Touch-Device über uinput
"""
import evdev
from evdev import UInput, AbsInfo, ecodes
import logging

logger = logging.getLogger(__name__)


class VirtualTouchDevice:
    """Virtuelles Touch-Device für Remote-Control"""

    # Display-Auflösung (sollte mit dem echten Display übereinstimmen)
    SCREEN_WIDTH = 1920
    SCREEN_HEIGHT = 1200

    def __init__(self):
        """Initialisiert das virtuelle Touch-Device"""
        self.device = None
        self._create_device()

    def _create_device(self):
        """Erstellt das virtuelle uinput-Device"""
        try:
            # Capabilities für Touchscreen
            capabilities = {
                ecodes.EV_ABS: [
                    (ecodes.ABS_X, AbsInfo(
                        value=0,
                        min=0,
                        max=self.SCREEN_WIDTH,
                        fuzz=0,
                        flat=0,
                        resolution=9
                    )),
                    (ecodes.ABS_Y, AbsInfo(
                        value=0,
                        min=0,
                        max=self.SCREEN_HEIGHT,
                        fuzz=0,
                        flat=0,
                        resolution=9
                    )),
                    (ecodes.ABS_MT_SLOT, AbsInfo(0, 0, 1, 0, 0, 0)),
                    (ecodes.ABS_MT_POSITION_X, AbsInfo(
                        value=0,
                        min=0,
                        max=self.SCREEN_WIDTH,
                        fuzz=0,
                        flat=0,
                        resolution=9
                    )),
                    (ecodes.ABS_MT_POSITION_Y, AbsInfo(
                        value=0,
                        min=0,
                        max=self.SCREEN_HEIGHT,
                        fuzz=0,
                        flat=0,
                        resolution=9
                    )),
                    (ecodes.ABS_MT_TRACKING_ID, AbsInfo(0, 0, 65535, 0, 0, 0)),
                ],
                ecodes.EV_KEY: [
                    ecodes.BTN_TOUCH,
                ],
            }

            # Device erstellen
            self.device = UInput(
                capabilities,
                name="BoatOS Remote Touch",
                vendor=0x0001,
                product=0x0001,
                version=0x0001,
                bustype=0x03  # USB
            )

            logger.info(f"Virtual touch device created: {self.device.device.path}")

        except Exception as e:
            logger.error(f"Failed to create virtual device: {e}")
            raise

    def touch_down(self, x: int, y: int):
        """Touch-Down Event (Finger berührt Display)"""
        if not self.device:
            return

        try:
            # Koordinaten begrenzen
            x = max(0, min(x, self.SCREEN_WIDTH))
            y = max(0, min(y, self.SCREEN_HEIGHT))

            # Multi-Touch Slot 0
            self.device.write(ecodes.EV_ABS, ecodes.ABS_MT_SLOT, 0)
            # Tracking ID setzen (Touch beginnt)
            self.device.write(ecodes.EV_ABS, ecodes.ABS_MT_TRACKING_ID, 1)
            # Position setzen
            self.device.write(ecodes.EV_ABS, ecodes.ABS_MT_POSITION_X, x)
            self.device.write(ecodes.EV_ABS, ecodes.ABS_MT_POSITION_Y, y)
            # Absolute Position setzen
            self.device.write(ecodes.EV_ABS, ecodes.ABS_X, x)
            self.device.write(ecodes.EV_ABS, ecodes.ABS_Y, y)
            # Touch-Button drücken
            self.device.write(ecodes.EV_KEY, ecodes.BTN_TOUCH, 1)
            # Sync
            self.device.syn()

            logger.debug(f"Touch down at ({x}, {y})")

        except Exception as e:
            logger.error(f"Error in touch_down: {e}")

    def touch_move(self, x: int, y: int):
        """Touch-Move Event (Finger bewegt sich)"""
        if not self.device:
            return

        try:
            # Koordinaten begrenzen
            x = max(0, min(x, self.SCREEN_WIDTH))
            y = max(0, min(y, self.SCREEN_HEIGHT))

            # Position aktualisieren
            self.device.write(ecodes.EV_ABS, ecodes.ABS_MT_POSITION_X, x)
            self.device.write(ecodes.EV_ABS, ecodes.ABS_MT_POSITION_Y, y)
            self.device.write(ecodes.EV_ABS, ecodes.ABS_X, x)
            self.device.write(ecodes.EV_ABS, ecodes.ABS_Y, y)
            # Sync
            self.device.syn()

            logger.debug(f"Touch move to ({x}, {y})")

        except Exception as e:
            logger.error(f"Error in touch_move: {e}")

    def touch_up(self):
        """Touch-Up Event (Finger verlässt Display)"""
        if not self.device:
            return

        try:
            # Tracking ID auf -1 (Touch endet)
            self.device.write(ecodes.EV_ABS, ecodes.ABS_MT_TRACKING_ID, -1)
            # Touch-Button loslassen
            self.device.write(ecodes.EV_KEY, ecodes.BTN_TOUCH, 0)
            # Sync
            self.device.syn()

            logger.debug("Touch up")

        except Exception as e:
            logger.error(f"Error in touch_up: {e}")

    def close(self):
        """Schließt das virtuelle Device"""
        if self.device:
            self.device.close()
            logger.info("Virtual touch device closed")


if __name__ == "__main__":
    # Test-Code
    import time

    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    print("Testing virtual touch device...")
    print("Creating device...")

    try:
        device = VirtualTouchDevice()
        print(f"Device created at: {device.device.device.path}")

        print("Testing touch sequence...")
        # Touch down in der Mitte
        device.touch_down(960, 600)
        time.sleep(0.5)

        # Move nach rechts
        for i in range(10):
            device.touch_move(960 + i * 50, 600)
            time.sleep(0.05)

        # Touch up
        device.touch_up()
        time.sleep(0.5)

        print("Test completed!")
        device.close()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
