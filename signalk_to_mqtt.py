#!/usr/bin/env python3
"""
SignalK to MQTT Bridge
Reads data from SignalK WebSocket and publishes to MQTT broker
"""
import asyncio
import json
import paho.mqtt.client as mqtt
import websockets
import time

SIGNALK_WS = "ws://localhost:3000/signalk/v1/stream"
MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC_PREFIX = "boat/"

mqtt_client = None

def on_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Connected to MQTT broker")
    else:
        print(f"⚠️ MQTT connection failed: {rc}")

async def signalk_to_mqtt():
    global mqtt_client
    
    # Setup MQTT client
    mqtt_client = mqtt.Client(client_id="signalk_mqtt_bridge")
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
    mqtt_client.loop_start()
    
    print(f"🔌 Connecting to SignalK at {SIGNALK_WS}")
    
    while True:
        try:
            async with websockets.connect(SIGNALK_WS) as ws:
                print("✅ Connected to SignalK WebSocket")
                
                async for message in ws:
                    data = json.loads(message)
                    
                    # Process SignalK deltas
                    if "updates" in data:
                        for update in data["updates"]:
                            if "values" in update:
                                for value in update["values"]:
                                    path = value.get("path", "")
                                    val = value.get("value")
                                    
                                    if path and val is not None:
                                        # Convert path to MQTT topic
                                        # e.g., navigation.position -> boat/navigation/position
                                        mqtt_topic = MQTT_TOPIC_PREFIX + path.replace(".", "/")
                                        
                                        # Handle complex values (like position)
                                        if isinstance(val, dict):
                                            # Publish sub-values
                                            for key, subval in val.items():
                                                sub_topic = f"{mqtt_topic}/{key}"
                                                mqtt_client.publish(sub_topic, str(subval))
                                        else:
                                            # Publish simple value
                                            mqtt_client.publish(mqtt_topic, str(val))
                                        
                                        print(f"📤 {mqtt_topic}: {val}")
        
        except Exception as e:
            print(f"⚠️ Connection error: {e}")
            print("🔄 Reconnecting in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(signalk_to_mqtt())
